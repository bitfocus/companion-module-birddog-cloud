import { combineRgb } from '@companion-module/base'

export function getPresets() {
	const ColorWhite = combineRgb(255, 255, 255)
	const ColorBlack = combineRgb(0, 0, 0)
	const ColorRed = combineRgb(200, 0, 0)
	const ColorGreen = combineRgb(0, 200, 0)
	const ColorOrange = combineRgb(255, 102, 0)

	let presets = {}

	if (this.states.endpoints) {
		this.states.endpoints.forEach((endpoint) => {
			let id = endpoint.id
			let name = endpoint.name
			presets[`endpoint_${name}_status`] = {
				type: 'button',
				category: 'Endpoints',
				name: `Endpoint ${name} Status`,
				options: {},
				style: {
					text: `${name}\\n\\n$(birddog-cloud:endpoint_status_${name})`,
					size: '7',
					color: ColorWhite,
					bgcolor: ColorBlack,
				},
				steps: [
					{
						down: [],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'endpointOnline',
						options: {
							endpoint: `${id}`,
						},
						style: {
							bgcolor: ColorGreen,
						},
					},
					{
						feedbackId: 'endpointOnline',
						options: {
							endpoint: `${id}`,
						},
						style: {
							bgcolor: ColorRed,
						},
						isInverted: true,
					},
				],
			}
		})
	}

	if (this.states.connections) {
		this.states.connections.forEach((connection) => {
			let id = connection.id
			let name = connection.parameters.displayName ? connection.parameters.displayName : connection.id
			presets[`connection_${name}_toggle`] = {
				type: 'button',
				category: 'Connections',
				name: `Start/Stop ${name}`,
				options: {},
				style: {
					text: `Start/Stop\\n${name}`,
					size: '7',
					color: ColorWhite,
					bgcolor: ColorBlack,
				},
				steps: [
					{
						down: [
							{
								actionId: 'connectionToggle',
								options: {
									connection: id,
									command: 'TOGGLE',
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'connectionStatus',
						options: {
							connection: `${id}`,
						},
						style: {},
					},
				],
			}
		})
	}

	return presets
}
