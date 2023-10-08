import { InstanceBase, Regex, runEntrypoint, InstanceStatus } from '@companion-module/base'
import { getActions } from './actions.js'
import { getFeedbacks } from './feedbacks.js'
import { getPresets } from './presets.js'
import { getVariables } from './variables.js'
import { upgradeScripts } from './upgrades.js'

import fetch from 'node-fetch'
import SCClient from 'socketcluster-client'

class BirdDogCloudInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
	}

	//Module Setup
	async init(config) {
		this.config = config

		//Initialize Objects for Data Storage
		this.cloud = {} //Basic Cloud Info (Company, Refresh Token)
		this.auth = {} //Socketcluster-specific auth
		this.states = {} //Channel data from Cloud
		this.choices = {} //Dropdown options for Companion

		//Auth setup for Socketcluster
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

		//Start Connection to Cloud
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

	initActions() {
		const actions = getActions.bind(this)()
		this.setActionDefinitions(actions)
	}

	initFeedbacks() {
		const feedbacks = getFeedbacks.bind(this)()
		this.setFeedbackDefinitions(feedbacks)
	}

	initPresets() {
		const presets = getPresets.bind(this)()
		this.setPresetDefinitions(presets)
	}

	initVariables() {
		const variables = getVariables.bind(this)()
		this.setVariableDefinitions(variables)
	}

	//Cloud API Connections
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

					if (parsedToken) {
						this.cloud.refreshToken = text
						this.cloud.refreshTokenExp = parsedToken?.exp
						this.cloud.companyId = parsedToken.cid

						this.log('info', 'Connected to BirdDog Cloud')
						this.updateStatus(InstanceStatus.Ok)

						this.startPoll()
						this.getCloudInfo()
						this.startWebsocket()
					}
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
					console.log('Socket is connected')
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
			let channel = this.socket.subscribe(`/connections/${this.cloud.companyId}`)
			for await (let message of channel) {
				this.processChannelUpdate(message.msg, 'connections', message)
			}
		})()
		;(async () => {
			let channel = this.socket.subscribe(`/endpoints/${this.cloud.companyId}`)
			for await (let message of channel) {
				this.processChannelUpdate(message.msg, 'endpoints', message)
			}
		})()
		/* ;(async () => {
			let channel = this.socket.subscribe(`/recordings/${this.cloud.companyId}`)
			for await (let message of channel) {
				this.processChannelUpdate(message.msg, 'recordings', message)
			}
		})() */
		;(async () => {
			while (this.socket) {
				for await (let event of this.socket.listener('message')) {
					//console.log(event)
				}
			}
		})()
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

	//Handle Cloud Socketcluster Data
	processChannelUpdate(type, channel, message) {
		switch (type) {
			case 'init':
				this.channelInit(channel, message.data)
				break
			case 'add':
				this.channelAdd(channel, message.data)
				break
			case 'delete':
				this.channelDelete(channel, message.data)
				break
			case 'update':
				this.channelUpdate(channel, message.data)
				break
			default:
				console.log(`Unknown channel message type: ${type}`)
				break
		}
	}

	channelInit(channel, data) {
		this.states[`${channel}`] = data

		this.setupChannel(channel)
	}

	channelAdd(channel, data) {
		let arr = this.states[`${channel}`]
		if (!arr) return
		let index = arr.findIndex((el) => el.id === data.id)
		if (index === -1) arr.push(data)
		else arr[index] = data

		this.setupChannel(channel)
	}

	channelDelete(channel, data) {
		let arr = this.states[`${channel}`]
		if (!arr) return
		let index = arr.findIndex((el) => el.id === data)
		if (index !== -1) arr.splice(index, 1)

		this.setupChannel(channel)
	}

	channelUpdate(channel, data) {
		let arr = this.states[`${channel}`]
		if (!arr) return
		let index = arr.findIndex((el) => el.id === data.id)
		if (index === -1) return
		Object.assign(arr[index], data.data)

		this.initVariables() //temp
		this.checkFeedbacks()
		this.setupEndpoints()
	}

	setupChannel(channel) {
		switch (channel) {
			case 'endpoints':
				this.setupEndpoints()
				break
			case 'connections':
				this.setupRecorders()
				break
			case 'recorders':
				this.setupRecorders()
				break
			case 'recordings':
				this.setupRecorders()
				break
			default:
				console.log('Unknown setup channel')
				break
		}
	}

	syncChannel(channel) {
		/* switch (channel) {
			case 'endpoints':
				this.setupEndpoints()
				break
			case 'connections':
				this.setupRecorders()
				break
			case 'recorders':
				this.setupRecorders()
				break
			case 'recordings':
				this.setupRecorders()
				break
			default:
				console.log('Unknown setup channel')
				break
		} */
	}

	//Handle Cloud REST Data
	getCloudInfo() {
		this.sendCommand('company/endpoints', 'get')
		this.sendCommand('connections', 'get')
		this.sendCommand('company/recorders', 'get')
	}

	processData(cmd, data) {
		switch (cmd) {
			case 'company/endpoints':
				this.states.endpoints = data
				this.setupEndpoints()
				break
			case 'connections':
				this.states.connections = data
				this.setupConnections()
				break
			case 'company/recorders':
				this.states.recorders = data
				this.setupRecorders()
				break
			case 'recordings':
				this.states.recordings = data
				this.setupRecordings()
				break
			default:
				console.log(`Unknown REST data received: ${cmd}`)
				break
		}
	}

	//Send Commands to Cloud API
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

	async sendPresenterCommand(sourceId, connectionId, command, field, value) {
		;(async () => {
			let result
			let object = {
				sourceId: sourceId,
				connectionId: connectionId,
				[`${field}`]: value,
			}
			console.log(object)
			try {
				result = await this.socket.invoke(command, object)
				console.log(result)
			} catch (error) {
				console.log(error)
			}
		})()
	}

	//Channel Specific Functions
	getConnectionDisplayName(connection) {
		if (connection.parameters.displayName) {
			return connection.parameters.displayName
		} else {
			if (connection.parameters.connectionType === 'MULTI_VIEW') {
				let sourceCount = connection.parameters.videoSources.length ? connection.parameters.videoSources.length : ''
				return `MV ${sourceCount}`
			} else {
				if (connection.parameters.videoSources[0]) {
					return connection.parameters.videoSources[0].name
						? connection.parameters.videoSources[0].name
						: connection.parameters.videoSources[0]
				} else {
					return connection.id
				}
			}
		}
	}

	setupConnections() {
		this.choices.connections = []
		this.choices.presenters = []

		this.states.connections.forEach((connection) => {
			let id = connection.id
			let name = connection.id
			name = this.getConnectionDisplayName(connection)

			if (connection.parameters.multiView) {
				if (connection.parameters.multiView.layout.match('PRESENTER_')) {
					this.choices.presenters.push({ id: id, label: name })
				}
			}

			this.choices.connections.push({ id: id, label: name })
			this.setVariableValues({
				[`connection_status_${name}`]: connection.state === 'CONNECTED' ? 'Connected' : 'Stopped',
			})
		})
		this.initActions()
		this.initFeedbacks()
		this.initVariables()
		this.checkFeedbacks()
		this.initPresets()
	}

	setupEndpoints() {
		this.choices.endpoints = []
		this.choices.audioDevices = []

		this.states.endpoints.forEach((endpoint) => {
			let id = endpoint.id
			let name = endpoint.name

			this.choices.endpoints.push({ id: id, label: name })

			endpoint.audioDevices?.forEach((device) => {
				let name = device.value
				this.choices.audioDevices.push({ id: name, label: name })
			})

			this.setVariableValues({ [`endpoint_status_${name}`]: endpoint.online ? 'Connected' : 'Offline' })
		})
		this.initActions()
		this.initFeedbacks()
		this.initVariables()
		this.checkFeedbacks()
		this.initPresets()
	}

	setupRecorders() {
		this.choices.recorders = []
		this.states.recorders.forEach((recorder) => {
			let id = recorder.id
			let name = recorder.name

			this.choices.recorders.push({ id: id, label: name })
		})
		//After recorders are set, get recording info
		this.sendCommand('recordings', 'get')
	}

	setupRecordings() {
		this.choices.recordings = []
		this.states.recordings.forEach((recording) => {
			let id = recording.id
			let name = recording.parameters.input
			let recorder = this.states.recorders.find(({ id }) => id === recording.recorderId)

			if (recorder) {
				name = `${recorder.name}-${name}`
			}

			this.choices.recordings.push({ id: id, label: name })
		})

		this.initActions()
		this.initFeedbacks()
		this.initVariables()
		this.checkFeedbacks()
		this.initPresets()
	}
}

runEntrypoint(BirdDogCloudInstance, upgradeScripts)
