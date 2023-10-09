export function getActions() {
	let startStopOptions = [
		{ id: 'TOGGLE', label: 'Toggle' },
		{ id: 'START', label: 'Start' },
		{ id: 'STOP', label: 'Stop' },
	]

	let presenterLayoutOptions = [
		{ id: 'setFullscreenMain', label: 'Main Source Fullscreen' },
		{ id: 'setFullscreenVideo', label: 'Video Source Fullscreen' },
		{ id: 'setMixed', label: 'Mix Sources' },
	]

	return {
		connectionControl: {
			name: 'Start/Stop Connection',
			options: [
				{
					type: 'dropdown',
					label: 'Connections',
					id: 'connection',
					choices: this.choices.connections,
					default: this.choices.connections[0]?.id,
				},
				{
					type: 'dropdown',
					label: 'Command',
					id: 'command',
					choices: startStopOptions,
					default: 'TOGGLE',
				},
			],
			callback: (action) => {
				let state

				if (action.options.command === 'TOGGLE') {
					let connection = this.states.connections.find(({ id }) => id === action.options.connection)
					if (connection) {
						state = connection.state === 'CONNECTED' ? 'STOP' : 'START'
					}
				} else {
					state = action.options.command
				}

				this.sendCommand(`connection/action`, 'POST', { id: action.options.connection, action: state })
			},
		},
		recordingControl: {
			name: 'Start/Stop Recordings',
			options: [
				{
					type: 'multidropdown',
					label: 'Recordings',
					id: 'recordings',
					choices: this.choices.recordings,
				},
				{
					type: 'dropdown',
					label: 'Action',
					id: 'command',
					choices: [
						{ id: 'START', label: 'Start' },
						{ id: 'STOP', label: 'Stop' },
					],
					default: 'START',
				},
			],
			callback: (action) => {
				let field
				let recordings
				let state

				if (action.options.recordings.length > 1) {
					field = 'ids'
					recordings = action.options.recordings
					state = action.options.command === 'START' ? 'START_MULTIPLE' : 'STOP_MULTIPLE'
				} else {
					field = 'id'
					recordings = action.options.recordings[0]
					state = action.options.command
				}

				this.sendCommand(`recording/action`, 'POST', {
					[`${field}`]: recordings,
					action: state,
				})
			},
		},
		presenterLayout: {
			name: 'Set Presenter Layout',
			options: [
				{
					type: 'dropdown',
					label: 'Presenter Connection',
					id: 'connection',
					choices: this.choices.presenters,
					default: this.choices.presenters[0]?.id,
				},
				{
					type: 'dropdown',
					label: 'Layout',
					id: 'layout',
					choices: presenterLayoutOptions,
					default: 'setFullscreenMain',
				},
			],
			callback: (action) => {
				let connection = this.states.connections.find(({ id }) => id === action.options.connection)
				let layout = action.options.layout === 'setMixed' ? 'setMixed' : 'setFullscreen'
				let sourceName

				if (action.options.layout === 'setMixed' || action.options.layout === 'setFullscreenVideo') {
					sourceName = connection.parameters.multiView.firstVideoSource
				} else {
					sourceName = connection.parameters.multiView.mainSource
				}

				this.sendPresenterCommand(connection.sourceId, connection.id, layout, 'sourceName', sourceName)
			},
		},
		presenterAudioDevice: {
			name: 'Set Presenter Audio Device',
			options: [
				{
					type: 'dropdown',
					label: 'Presenter Connection',
					id: 'connection',
					choices: this.choices.presenters,
					default: this.choices.presenters[0]?.id,
				},
				{
					type: 'dropdown',
					label: 'Audio Device',
					id: 'audio',
					choices: this.choices.audioDevices,
					default: this.choices.audioDevices[0]?.id,
				},
			],
			callback: (action) => {
				let connection = this.states.connections.find(({ id }) => id === action.options.connection)
				let endpoint = this.states.endpoints.find(({ id }) => id === connection.sourceId)
				let fieldType = 'deviceName'

				if (endpoint && endpoint?.ndiSources) {
					let source = endpoint.ndiSources.find((element) => element === action.options.audio)
					if (source) {
						fieldType = 'sourceName'
					}
				}

				this.sendPresenterCommand(
					connection.sourceId,
					connection.id,
					'setAudioReceiver',
					fieldType,
					action.options.audio,
				)
			},
		},
	}
}
