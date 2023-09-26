import { combineRgb } from '@companion-module/base'

export function getFeedbacks() {
	const feedbacks = {}

	const ColorWhite = combineRgb(255, 255, 255)
	const ColorBlack = combineRgb(0, 0, 0)
	const ColorRed = combineRgb(200, 0, 0)
	const ColorGreen = combineRgb(0, 200, 0)
	const ColorOrange = combineRgb(255, 102, 0)

	let connectionColors = {
		CONNECTED: ColorGreen,
		CONNECTING: ColorOrange,
		FAILED: ColorRed,
		STOPPED: ColorBlack,
	}

	feedbacks['connectionStarted'] = {
		type: 'boolean',
		name: 'Connection Connected',
		description: 'Change style if a connection is active',
		defaultStyle: {
			bgcolor: ColorGreen,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Connections',
				id: 'connection',
				choices: this.connectionList,
			},
		],
		callback: (feedback) => {
			let connection = this.states.connections.find(({ id }) => id === feedback.options.connection)
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
		description: 'Change style if a connection is active',
		options: [
			{
				type: 'dropdown',
				label: 'Connections',
				id: 'connection',
				choices: this.connectionList,
			},
		],
		callback: (feedback) => {
			let connection = this.states.connections.find(({ id }) => id === feedback.options.connection)
			console.log(connection)
			return { bgcolor: connectionColors[`${connection.state}`] }
		},
	}

	return feedbacks
}
