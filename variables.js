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
			name = this.getConnectionDisplayName(connection)
			let cleanName = name.replace(/[\W]/gi, '_')

			variables.push({
				name: `Connection Status - ${name}`,
				variableId: `connection_status_${cleanName}`,
			})
			this.setVariableValues({ [`connection_status_${cleanName}`]: connectionStates[`${connection.state}`] })
		})
	}

	if (this.states.endpoints) {
		this.states.endpoints.forEach((endpoint) => {
			let name = endpoint.name
			let cleanName = name.replace(/[\W]/gi, '_')
			variables.push({
				name: `Endpoint Status - ${name}`,
				variableId: `endpoint_status_${cleanName}`,
			})
			this.setVariableValues({ [`endpoint_status_${cleanName}`]: endpoint.online ? 'Connected' : 'Offline' })
		})
	}

	if (this.states.recordings) {
		this.states.recordings.forEach((recording) => {
			let name = recording.parameters?.input
			let cleanName = name.replace(/[\W]/gi, '_')
			variables.push({
				name: `Recording Status - ${name}`,
				variableId: `recording_status_${cleanName}`,
			})
			this.setVariableValues({ [`recording_status_${cleanName}`]: recording.isStarted ? 'Recording' : 'Stopped' })
		})
	}

	variables.push({
		name: `Presenter - Selected PTZ Device`,
		variableId: `presenter_ptz_device`,
	})
	this.setVariableValues({
		presenter_ptz_device: this.states.ptzDevice?.sourceName ? this.states.ptzDevice.sourceName : 'None',
	})

	return variables
}
