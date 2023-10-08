import { combineRgb } from '@companion-module/base'

export function getFeedbacks() {
	const feedbacks = {}

	const ColorWhite = combineRgb(255, 255, 255)
	const ColorGray = combineRgb(110, 110, 110)
	const ColorBlack = combineRgb(0, 0, 0)
	const ColorRed = combineRgb(200, 0, 0)
	const ColorGreen = combineRgb(0, 200, 0)
	const ColorOrange = combineRgb(255, 102, 0)

	let connectionColors = {
		CONNECTED: ColorGreen,
		CONNECTING: ColorOrange,
		FAILED: ColorRed,
		STOPPED: ColorGray,
	}

	feedbacks['connectionStarted'] = {
		type: 'boolean',
		name: 'Connection Connected',
		description: 'Change style if a connection is connected',
		defaultStyle: {
			bgcolor: ColorGreen,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Connections',
				id: 'connection',
				choices: this.choices.connections,
				default: this.choices.connections[0]?.id,
			},
		],
		callback: (feedback) => {
			let connection = this.states.connections?.find(({ id }) => id === feedback.options.connection)
			if (connection) {
				return connection.state === 'CONNECTED' ? true : false
			} else {
				return false
			}
		},
	}

	feedbacks['connectionStatus'] = {
		type: 'advanced',
		name: 'Connection Status',
		description: 'Change background color based on connection status',
		options: [
			{
				type: 'dropdown',
				label: 'Connections',
				id: 'connection',
				choices: this.choices.connections,
				default: this.choices.connections[0]?.id,
			},
		],
		callback: (feedback) => {
			let connection = this.states.connections?.find(({ id }) => id === feedback.options.connection)
			return { bgcolor: connectionColors[`${connection.state}`] }
		},
	}

	feedbacks['endpointOnline'] = {
		type: 'boolean',
		name: 'Endpoint Online',
		description: 'Change style if an endpoint is online',
		defaultStyle: {
			bgcolor: ColorGreen,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Endpoints',
				id: 'endpoint',
				choices: this.choices.endpoints,
				default: this.choices.endpoints[0]?.id,
			},
		],
		callback: (feedback) => {
			let endpoint = this.states.endpoints?.find(({ id }) => id === feedback.options.endpoint)
			if (endpoint) {
				return endpoint.online
			} else {
				return false
			}
		},
	}

	return feedbacks
}
