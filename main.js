import { InstanceBase, runEntrypoint, InstanceStatus } from '@companion-module/base'
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
		this.states.presenters = {}
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
	async initConnection() {
		let token = await this.getRefreshToken()
		if (token) {
			this.log('info', 'Connected to BirdDog Cloud')
			this.updateStatus(InstanceStatus.Ok)

			this.getCloudInfo()
			this.startWebsocket()
		} else {
			this.updateStatus(InstanceStatus.ConnectionFailure)
			this.log('debug', 'Unable to authenticate with refresh token')
		}
	}

	async startWebsocket() {
		let authenticated = await this.getWebsocketAuth()
		if (authenticated) {
			this.startSocketCluster()
		} else {
			this.log('debug', 'Unable to authenticate with Socketcluster')
		}
	}

	async startSocketCluster() {
		//Close socket before creating a new one
		if (this.socket !== undefined) {
			this.socket.disconnect()
			this.socket = null
		}

		//Create socket
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

		//Socket Listeners
		;(async () => {
			while (this.socket) {
				for await (let _event of this.socket.listener('connect')) {
					//console.log('Socket connected')
				}
			}
		})()
		;(async () => {
			while (this.socket) {
				for await (let event of this.socket.listener('disconnect')) {
					//console.log('Socket disconnected')
				}
			}
		})()
		;(async () => {
			while (this.socket) {
				for await (let event of this.socket.listener('deauthenticate')) {
					this.getWebsocketAuth()
					//console.log(`Socket lost authentication`)
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
				for await (let event of this.socket.listener('subscribeFail')) {
					//console.log(`Failed to subscribe to channel: ${event.channel}`)
					this.log('debug', `Failed to subscribe to channel: ${event.channel}`)
				}
			}
		})()
		;(async () => {
			while (this.socket) {
				for await (let event of this.socket.listener('error')) {
					if (event.error.code === 4401 || event.error.code === 4001) {
						//console.log(`Disconnected, will reconnect`)
					} else {
						this.log('debug', `Disconnected: ${event}`)
					}
				}
			}
		})()
		;(async () => {
			while (this.socket) {
				for await (let event of this.socket.listener('message')) {
					//console.log(event)
				}
			}
		})()

		//Socket Channel Subscriptions
		;(async () => {
			let channel = this.socket.subscribe(`/connections/${this.cloud.companyId}`, { batch: true })
			for await (let message of channel) {
				this.processChannelUpdate(message.msg, 'connections', message)
			}
		})()
		;(async () => {
			let channel = this.socket.subscribe(`/endpoints/${this.cloud.companyId}`, { batch: true })
			for await (let message of channel) {
				this.processChannelUpdate(message.msg, 'endpoints', message)
			}
		})()
		;(async () => {
			let channel = this.socket.subscribe(`/recorders/${this.cloud.companyId}`, { batch: true })
			for await (let message of channel) {
				this.processChannelUpdate(message.msg, 'recorders', message)
			}
		})()
		;(async () => {
			let channel = this.socket.subscribe(`/recordings/${this.cloud.companyId}`, { batch: true })
			for await (let message of channel) {
				this.processChannelUpdate(message.msg, 'recordings', message)
			}
		})()
	}

	//Authentication Requests
	async getRefreshToken() {
		return fetch(`https://app.birddog.cloud/api/refresh-token`, {
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
						return true
					} else {
						return false
					}
				}
			})
			.catch((error) => {
				console.log(error)
				this.log('debug', error)
			})
	}

	async checkTokenExpiry() {
		let now = Date.now() / 1000

		if (this.cloud.refreshTokenExp > now) {
			return true
		} else {
			let newToken = await this.getRefreshToken()
			if (newToken) {
				return true
			} else {
				return false
			}
		}
	}

	async getWebsocketAuth() {
		return fetch(`https://app.birddog.cloud/api/load-token`, {
			method: 'get',
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
					this.cloud.websocketToken = json
					let parsedToken = JSON.parse(Buffer.from(json.split('.')[1], 'base64').toString())
					this.cloud.websocketTokenExp = parsedToken?.exp
					this.websocketAuthEngine.saveToken('websocketToken', json)
					return true
				} else {
					return false
				}
			})
			.catch((error) => {
				console.log(error)
				this.log('debug', error)
				this.updateStatus(InstanceStatus.ConnectionFailure)
			})
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
				this.log('debug', `Unknown channel message type: ${type}`)
				break
		}
	}

	channelInit(channel, data) {
		this.states[`${channel}`] = data

		this.setupChannel(channel)
	}

	channelAdd(channel, data) {
		let prevState = this.states[`${channel}`]

		if (prevState) {
			let index = prevState.findIndex((el) => el.id === data.id)
			if (index === -1) {
				prevState.push(data)
			} else {
				prevState[index] = data
			}
		}

		this.setupChannel(channel)
	}

	channelDelete(channel, data) {
		let prevState = this.states[`${channel}`]

		if (prevState) {
			let index = prevState.findIndex((el) => el.id === data)
			if (index !== -1) {
				prevState.splice(index, 1)
			}
		}

		this.setupChannel(channel)
	}

	channelUpdate(channel, data) {
		let prevState = this.states[`${channel}`]

		if (prevState) {
			let index = prevState.findIndex((el) => el.id === data.id)
			if (index > -1) {
				Object.assign(prevState[index], data.data)
			}
		}

		this.updateChannel(channel, data)
	}

	setupChannel(channel) {
		switch (channel) {
			case 'endpoints':
				this.setupEndpoints()
				break
			case 'connections':
				this.setupConnections()
				break
			case 'recorders':
				this.setupRecorders()
				break
			case 'recordings':
				this.setupRecordings()
				break
			default:
				this.log('debug', `Unknown setup channel: ${channel}`)
				break
		}
	}

	updateChannel(channel, data) {
		switch (channel) {
			case 'endpoints':
				this.updateEndpoints(data)
				break
			case 'connections':
				this.updateConnections(data)
				break
			case 'recorders':
				this.setupRecorders()
				break
			case 'recordings':
				this.updateRecordings(data)
				break
			default:
				this.log('debug', `Unknown sync channel: ${channel}`)
				break
		}
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
				this.log('debug', `Unknown REST data received: ${cmd}`)
				break
		}
	}

	//Send Commands to Cloud API
	async sendCommand(cmd, type, params) {
		let url = `https://app.birddog.cloud/api/${cmd}`
		let options = {}

		let fresh = await this.checkTokenExpiry()

		if (fresh) {
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
					console.log(error)
					this.log('debug', error)
				})
		}
	}

	async sendPresenterCommand(command, body) {
		;(async () => {
			let result
			try {
				result = await this.socket.invoke(command, body)
			} catch (error) {
				this.log('debug', `Error sending presenter command: ${error}`)
			}
		})()
	}

	//Channel Specific Functions
	setupConnections() {
		this.choices.connections = []
		this.choices.presenters = []
		this.choices.presentersSources = []

		this.states.connections.forEach((connection) => {
			let id = connection.id
			let name = connection.id
			name = this.getConnectionDisplayName(connection)

			if (connection.parameters.multiView) {
				if (connection.parameters.multiView.layout.match('PRESENTER_')) {
					this.choices.presenters.push({ id: id, label: name })

					let firstSource = connection?.parameters?.multiView?.firstVideoSource
					let videoSources = connection?.parameters?.videoSources

					if (firstSource) {
						if (typeof firstSource === 'object') {
							firstSource = firstSource.displayName ? firstSource.displayName : ''
						}
						let index = this.choices.presentersSources.findIndex((el) => el.id === firstSource)
						if (index === -1) {
							this.choices.presentersSources.push({ id: firstSource, label: firstSource })
						}
					}
					if (videoSources.length > 0) {
						videoSources.forEach((source) => {
							let index = this.choices.presentersSources.findIndex((el) => el.id === source)
							if (index === -1) {
								this.choices.presentersSources.push({ id: source, label: source })
							}
						})
					}

					this.setupPresenter(connection)
				}
			}

			this.choices.connections.push({ id: id, label: name })
			this.setVariableValues({
				[`connection_status_${name}`]: connection.state === 'CONNECTED' ? 'Connected' : 'Stopped',
			})
		})
		this.initActions()
		this.initFeedbacks()
		this.initPresets()
		this.initVariables()
		this.checkFeedbacks()
	}

	updateConnections(data) {
		let connectionId = data.id
		let newData = data.data

		let connection = this.states.connections?.find(({ id }) => id === connectionId)
		let name = connection.id
		name = this.getConnectionDisplayName(connection)

		if ('state' in newData) {
			let connectionStates = {
				CONNECTED: 'Connected',
				CONNECTING: 'Connecting',
				FAILED: 'Failed',
				STOPPED: 'Stopped',
			}

			this.setVariableValues({
				[`connection_status_${name}`]: connectionStates[`${newData.state}`],
			})
			this.checkFeedbacks('connectionStatus', 'connectionConnected')
		}
	}

	setupEndpoints() {
		this.choices.endpoints = []
		this.choices.audioDevices = []
		this.choices.ndiSources = []

		this.states.endpoints.forEach((endpoint) => {
			let id = endpoint.id
			let name = endpoint.name

			this.choices.endpoints.push({ id: id, label: name })

			endpoint.ndiSources?.forEach((device) => {
				let index = this.choices.audioDevices.findIndex((el) => el.id === device)
				if (index === -1) {
					this.choices.audioDevices.push({ id: device, label: device })
				}
				let indexNdi = this.choices.ndiSources.findIndex((el) => el.id === device)
				if (indexNdi === -1) {
					this.choices.ndiSources.push({ id: device, label: device })
				}
			})
			endpoint.audioDevices?.forEach((device) => {
				let name = device.value
				let index = this.choices.audioDevices.findIndex((el) => el.id === name)
				if (index === -1) {
					this.choices.audioDevices.push({ id: name, label: name })
				}
			})

			this.setVariableValues({ [`endpoint_status_${name}`]: endpoint.online ? 'Connected' : 'Offline' })
		})
		this.initActions()
		this.initFeedbacks()
		this.initPresets()
		this.initVariables()
		this.checkFeedbacks()
	}

	updateEndpoints(data) {
		let endpointId = data.id
		let newData = data.data

		if ('online' in newData) {
			let endpoint = this.states.endpoints?.find(({ id }) => id === endpointId)

			let name = endpoint?.name
			let cleanName = name.replace(/[\W]/gi, '_')
			this.setVariableValues({ [`endpoint_status_${cleanName}`]: newData.online ? 'Connected' : 'Offline' })
			this.checkFeedbacks('endpointOnline')
		}
		if ('name' in newData) {
			this.setupEndpoints()
		}
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
		this.initPresets()
		this.initVariables()
		this.checkFeedbacks()
	}

	updateRecordings(data) {
		let recordingId = data.id
		let newData = data.data

		if ('isStarted' in newData) {
			let recording = this.states.recordings?.find(({ id }) => id === recordingId)
			let name = recording.parameters?.input
			let cleanName = name.replace(/[\W]/gi, '_')
			this.setVariableValues({ [`recording_status_${cleanName}`]: newData.isStarted ? 'Recording' : 'Stopped' })
			this.checkFeedbacks('recordingActive')
		}
	}

	//Presenter Mode
	async setupPresenter(connection) {
		let connectionId = connection.id
		let endpointId = connection.sourceId
		if (!this.states.presenters[connectionId]) {
			this.states.presenters[connectionId] = {}
		}

		if (this.socket) {
			;(async () => {
				let subState = this.socket.isSubscribed(`/presenter/${endpointId}/${connectionId}`)
				if (subState === false) {
					let channel = this.socket.subscribe(`/presenter/${endpointId}/${connectionId}`, { batch: true })
					for await (let message of channel) {
						this.processPresenterUpdate(message.msg, connectionId, message, connection)
					}
				}
			})()
		}
	}

	processPresenterUpdate(type, connectionId, message, connection) {
		switch (type) {
			case 'setFullscreen':
				let source = message.data.sourceName
				if (connection.parameters?.multiView?.mainSource === source) {
					this.states.presenters[connectionId].layout = 'setFullscreenMain'
				} else {
					this.states.presenters[connectionId].layout = 'setFullscreenVideo'
				}
				this.checkFeedbacks('presenterLayout')
				break
			case 'setMixed':
				this.states.presenters[connectionId].layout = 'setMixed'
				this.checkFeedbacks('presenterLayout')
				break
			case 'setAudioReceiver':
				this.states.presenters[connectionId].audioDevice = message.data.sourceName
					? message.data.sourceName
					: message.data.deviceName
				this.checkFeedbacks('presenterAudioDevice')
				break
			default:
				//console.log(`Unknown channel message type: ${type}`)
				break
		}
	}

	//Helper Functions
	getConnectionDisplayName(connection) {
		if (connection.parameters.displayName) {
			return connection.parameters.displayName
		} else {
			if (connection.parameters.connectionType === 'MULTI_VIEW') {
				let sourceCount = connection.parameters.videoSources.length ? connection.parameters.videoSources.length : ''
				return `MV ${sourceCount}`
			} else {
				if (connection.parameters.videoSources?.[0]) {
					return connection.parameters.videoSources[0].name
						? connection.parameters.videoSources[0].name
						: connection.parameters.videoSources[0]
				} else {
					return connection.id
				}
			}
		}
	}
}

runEntrypoint(BirdDogCloudInstance, upgradeScripts)
