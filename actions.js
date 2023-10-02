export function getActions() {
	let startStopOptions = [
		{ id: 'TOGGLE', label: 'Toggle' },
		{ id: 'START', label: 'Start' },
		{ id: 'STOP', label: 'Stop' },
	]

	let presenterViewOptions = [
		{ id: 'setFullscreenMain', label: 'Main Source Fullscreen' },
		{ id: 'setFullscreenVideo', label: 'Video Source Fullscreen' },
		{ id: 'setMixed', label: 'Mix Sources' },
	]
	return {
		connectionToggle: {
			name: 'Start/Stop Connection',
			options: [
				{
					type: 'dropdown',
					label: 'Connections',
					id: 'connection',
					choices: this.connectionList,
					default: this.connectionList[0]?.id,
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
				let state = null
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
		presenterToggle: {
			name: 'Presenter Control Layout',
			options: [
				{
					type: 'dropdown',
					label: 'Presenter Connection',
					id: 'connection',
					choices: this.presenterList,
					default: this.presenterList[0]?.id,
				},
				{
					type: 'dropdown',
					label: 'Layout',
					id: 'layout',
					choices: presenterViewOptions,
					default: 'setFullscreen',
				},
				{
					type: 'dropdown',
					label: 'Connections',
					id: 'source',
					choices: this.connectionList,
					default: this.connectionList[0]?.id,
				},
			],
			callback: (action) => {
				let connection = this.states.connections.find(({ id }) => id === action.options.connection)
				let source = this.states.connections.find(({ id }) => id === action.options.source)

				let layout = action.options.layout === 'setMixed' ? 'setMixed' : 'setFullscreen'
				let sourceName = source.parameters.displayName
				console.log(source)
				this.sendPresenterCommand(connection.sourceId, connection.id, layout, 'sourceName', sourceName)
			},
		},
	}
}
