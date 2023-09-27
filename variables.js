export function getVariables() {
	const variables = []

	let connectionStates = {
		CONNECTED: 'Connected',
		CONNECTING: 'Connecting',
		FAILED: 'Failed',
		STOPPED: 'Stopped',
	}

	if (this.states.connections) {
		this.states.connections.forEach((connection) => {
			let id = connection.id
			let name = connection.id
			if (connection.parameters.displayName) {
				name = connection.parameters.displayName
			} else {
				//console.log(connection.parameters.videoSources[0])
				//name = connection.parameters.videoSources[0].toString()
			}
			name = name.replace(/[\W]/gi, '_')
			variables.push({
				name: `${name} - Connection Status`,
				variableId: `${name}_status`,
			})
			this.setVariableValues({ [`${name}_status`]: connectionStates[`${connection.state}`] })
		})
	}

	if (this.states.endpoints) {
		this.states.endpoints.forEach((endpoint) => {
			let name = endpoint.name
			variables.push({
				name: `${name} - Endpoint Status`,
				variableId: `${name}_status`,
			})
			this.setVariableValues({ [`${name}_status`]: endpoint.online ? 'Connected' : 'Offline' })
		})
	}
	return variables
}
