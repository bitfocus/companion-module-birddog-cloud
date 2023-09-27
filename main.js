import { InstanceBase, Regex, runEntrypoint, InstanceStatus } from '@companion-module/base'
import { getActions } from './actions.js'
import { getPresets } from './presets.js'
import { getVariables } from './variables.js'
import { getFeedbacks } from './feedbacks.js'
import { upgradeScripts } from './upgrades.js'

import fetch from 'node-fetch'
import SCClient from 'socketcluster-client'

class BirdDogCloudInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
	}

	async init(config) {
		this.config = config
		this.cloud = {}
		this.states = {}
		this.auth = {}
		this.websocketAuthEngine = {
			saveToken: function (name, token, options) {
				this.auth = { [`${name}`]: token }
			},
			removeToken: function (name) {
				delete this.auth[name]
			},
			loadToken: function (name) {
				return Promise.resolve(this.auth[name])
			},
		}

		this.updateStatus(InstanceStatus.Connecting)
		this.initConnection()
	}

	async destroy() {
		this.log('debug', 'destroy')
	}

	async configUpdated(config) {
		this.config = config
		this.initConnection()
	}

	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'token',
				label: 'API Token',
				width: 8,
			},
		]
	}

	initVariables() {
		const variables = getVariables.bind(this)()
		this.setVariableDefinitions(variables)
	}

	initFeedbacks() {
		const feedbacks = getFeedbacks.bind(this)()
		this.setFeedbackDefinitions(feedbacks)
	}

	initPresets() {
		const presets = getPresets.bind(this)()
		this.setPresetDefinitions(presets)
	}

	initActions() {
		const actions = getActions.bind(this)()
		this.setActionDefinitions(actions)
	}

	initConnection() {
		fetch(`https://app.birddog.cloud/api/refresh-token`, {
			method: 'get',
			headers: { 'Content-type': 'application/json', Authorization: `Bearer ${this.config.token}` },
		})
			.then((res) => {
				if (res.status == 200) {
					return res.text()
				} else if (res.status == 401) {
					this.log('error', 'Invalid API Token')
					this.updateStatus(InstanceStatus.ConnectionFailure)
				}
			})
			.then((text) => {
				if (text) {
					let parsedToken = JSON.parse(Buffer.from(text.split('.')[1], 'base64').toString())

					this.cloud.refreshToken = text
					this.cloud.refreshTokenExp = parsedToken?.exp
					this.cloud.companyId = parsedToken.cid

					this.log('info', 'Connected to BirdDog Cloud')
					this.updateStatus(InstanceStatus.Ok)

					this.startPoll()
					this.getCloudInfo()
					this.startWebsocket()
				}
			})
			.catch((error) => {
				this.log('debug', error)
				this.updateStatus(InstanceStatus.ConnectionFailure)
			})
	}

	async startWebsocket() {
		fetch(`https://app.birddog.cloud/api/start-webrtc`, {
			method: 'post',
			body: JSON.stringify({}),
			headers: { 'Content-type': 'application/json', Authorization: `Bearer ${this.cloud.refreshToken}` },
		})
			.then((res) => {
				if (res.status == 200) {
					return res.json()
				} else if (res.status == 401) {
					this.log('error', 'Invalid API Token')
					this.updateStatus(InstanceStatus.ConnectionFailure)
				}
			})
			.then((json) => {
				if (json) {
					this.cloud.websocketToken = json.jwt
					this.websocketAuthEngine.saveToken('websocketToken', json.jwt)
					this.startSocketCluster()
				}
			})
			.catch((error) => {
				console.log(error)
				this.log('debug', error)
				this.updateStatus(InstanceStatus.ConnectionFailure)
			})
	}

	async startSocketCluster() {
		if (this.socket !== undefined) {
			this.destroy()
		}

		this.socket = SCClient.create({
			hostname: 'app.birddog.cloud',
			secure: true,
			path: '/socketcluster/',
			authEngine: this.websocketAuthEngine,
			authTokenName: 'websocketToken',
			autoReconnectOptions: {
				initialDelay: 1000, //milliseconds
				randomness: 500, //milliseconds
				multiplier: 1.5, //decimal
				maxDelay: 20000, //milliseconds
			},
		})
		;(async () => {
			while (this.socket) {
				for await (let _event of this.socket.listener('connect')) {
					// eslint-disable-line
					console.log('Socket is connected')
					console.log(this.socket.authState)
				}
			}
		})()
		;(async () => {
			while (this.socket) {
				for await (let event of this.socket.listener('authenticate')) {
					// In case a client is already listening
					if (this.socket.authState !== 'authenticated') {
						console.log(`Connection lost authentication, retrying`)
					}
				}
			}
		})()
		;(async () => {
			while (this.socket) {
				for await (let event of this.socket.listener('disconnect')) {
					console.log('disconnect')
				}
			}
		})()
		;(async () => {
			while (this.socket) {
				for await (let event of this.socket.listener('error')) {
					if (event.error.code === 4401) {
						// Disconnected by another process with the same id, let us disable this cloud instance,
						// to prevent connection looping
						console.log(`Disconnected`)
					} else {
						console.log(`DISCONNECT::::::::`, event)
					}
				}
			}
		})()
		;(async () => {
			while (this.socket) {
				for await (let event of this.socket.listener('subscribeStateChange')) {
					//console.log(event)
				}
			}
		})()
		;(async () => {
			while (this.socket) {
				for await (let event of this.socket.listener('subscribeStateChange')) {
					//console.log(event)
				}
			}
		})()
		;(async () => {
			let channel = this.socket.subscribe(`/connections/${this.cloud.companyId}`)
			for await (let message of channel) {
				this.processChannelUpdate(message.msg, 'connections', message)
			}
		})()
		;(async () => {
			let channel = this.socket.subscribe(`/endpoints/${this.cloud.companyId}`)
			for await (let message of channel) {
				console.log(message)
				this.processChannelUpdate(message.msg, 'endpoints', message)
			}
		})()
		;(async () => {
			while (this.socket) {
				for await (let event of this.socket.listener('message')) {
					//console.log(event)
				}
			}
		})()
	}

	processChannelUpdate(type, channel, message) {
		if (type === 'init') {
			this.channelInit(channel, message.data)
		} else if (type === 'add') {
			this.channelAdd(channel, message.data)
		} else if (type === 'delete') {
			this.channelDelete(channel, message.data)
		} else if (type === 'update') {
			this.channelUpdate(channel, message.data)
		} else {
			console.log('Unknown channel message type')
		}
	}

	channelInit(channel, data) {
		this.states[`${channel}`] = data
		this.setupConnections()
		this.setupEndpoints()
	}

	channelAdd(channel, data) {
		let arr = this.states[`${channel}`]
		if (!arr) return
		let index = arr.findIndex((el) => el.id === data.id)
		if (index === -1) arr.push(data)
		else arr[index] = data

		this.setupConnections()
	}

	channelDelete(channel, data) {
		let arr = this.states[`${channel}`]
		if (!arr) return
		let index = arr.findIndex((el) => el.id === data)
		if (index !== -1) arr.splice(index, 1)

		this.setupConnections()
	}

	channelUpdate(channel, data) {
		console.log(data)
		let arr = this.states[`${channel}`]
		if (!arr) return
		let index = arr.findIndex((el) => el.id === data.id)
		if (index === -1) return
		Object.assign(arr[index], data.data)

		this.initVariables() //temp
		this.checkFeedbacks()
		this.setupEndpoints()
	}

	startPoll() {
		//Token expires every 24hrs
		this.tokenReAuth = setInterval(() => {
			this.initConnection()
		}, 24 * 60 * 60 * 1000)
	}

	stopPoll() {
		if (this.tokenReAuth) {
			clearInterval(this.tokenReAuth)
			delete this.tokenReAuth
		}
	}

	getCloudInfo() {
		//this.sendCommand('company', 'get')
		//this.sendCommand('company/encoders', 'get')
		//this.sendCommand('company/endpoints', 'get')
		//this.sendCommand('company/recorders', 'get')
		this.sendCommand('connections', 'get')
		//this.sendCommand('company/recordings', 'get')
	}

	sendCommand(cmd, type, params) {
		let url = `https://app.birddog.cloud/api/${cmd}`
		let options = {}
		if (type == 'PUT' || type == 'POST') {
			options = {
				method: type,
				body: params != undefined ? JSON.stringify(params) : null,
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.cloud.refreshToken}` },
			}
		} else {
			options = {
				method: type,
				body: params != undefined ? JSON.stringify(params) : null,
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.cloud.refreshToken}` },
			}
		}

		fetch(url, options)
			.then((res) => {
				if (res.status == 200) {
					return res.json()
				}
			})

			.then((json) => {
				let data = json
				if (data) {
					this.processData(cmd, data)
				}
			})
			.catch((error) => {
				this.log('debug', error)
			})
	}

	processData(cmd, data) {
		if (cmd.match('company/endpoints')) {
		} else if (cmd.match('connections')) {
			this.states.connections = data
			this.setupConnections()
		} else {
			//console.log(cmd)
			//console.log(data)
		}
	}

	setupConnections() {
		this.connectionList = []
		this.states.connections.forEach((connection) => {
			let id = connection.id
			let name = connection.id

			if (connection.parameters.displayName) {
				name = connection.parameters.displayName
			} else {
				if (connection.parameters.videoSources[0]) {
					name = connection.parameters.videoSources[0].name
						? connection.parameters.videoSources[0].name
						: connection.parameters.videoSources[0]
				}
			}
			this.connectionList.push({ id: id, label: name })
			this.setVariableValues({ [`${name}_status`]: connection.state === 'CONNECTED' ? 'Connected' : 'Stopped' })
		})
		this.initActions()
		this.initFeedbacks()
		this.initVariables()
		this.checkFeedbacks()
		this.initPresets()
	}

	setupEndpoints() {
		this.endpointList = []
		this.states.endpoints.forEach((endpoint) => {
			let id = endpoint.id
			let name = endpoint.name

			this.endpointList.push({ id: id, label: name })
			this.setVariableValues({ [`${name}_status`]: endpoint.online ? 'Connected' : 'Offline' })
		})
		this.initActions()
		this.initFeedbacks()
		this.initVariables()
		this.checkFeedbacks()
		this.initPresets()
	}
}

runEntrypoint(BirdDogCloudInstance, upgradeScripts)
