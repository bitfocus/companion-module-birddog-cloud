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
				name: `Connection Status - ${name}`,
				variableId: `connection_status_${name}`,
			})
			this.setVariableValues({ [`connection_status_${name}`]: connectionStates[`${connection.state}`] })
		})
	}

	if (this.states.endpoints) {
		this.states.endpoints.forEach((endpoint) => {
			let name = endpoint.name
			variables.push({
				name: `Endpoint Status - ${name}`,
				variableId: `endpoint_status_${name}`,
			})
			this.setVariableValues({ [`endpoint_status_${name}`]: endpoint.online ? 'Connected' : 'Offline' })
		})
	}
	return variables
}
