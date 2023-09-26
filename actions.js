export function getActions() {
	let startStopOptions = [
		{ id: 'TOGGLE', label: 'Toggle' },
		{ id: 'START', label: 'Start' },
		{ id: 'STOP', label: 'Stop' },
	]
	return {
		connectionStarted: {
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
	}
}
