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
			let variableName = name.replace(/[\W]/gi, '_')

			presets[`endpoint_${name}_status`] = {
				type: 'button',
				category: 'Endpoint Status',
				name: `Endpoint ${name} Status`,
				options: {},
				style: {
					text: `${name}\\n\\n$(birddog-cloud:endpoint_status_${variableName})`,
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
			let name = connection.id
			name = this.getConnectionDisplayName(connection)
			let variableName = name.replace(/[\W]/gi, '_')

			presets[`connection_${name}_toggle`] = {
				type: 'button',
				category: 'Connection Actions',
				name: `Start/Stop ${name}`,
				options: {},
				style: {
					text: `START/STOP\\n\\n${name}`,
					size: '7',
					color: ColorWhite,
					bgcolor: ColorBlack,
				},
				steps: [
					{
						down: [
							{
								actionId: 'connectionControl',
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
			presets[`connection_${name}_start`] = {
				type: 'button',
				category: 'Connection Actions',
				name: `Start ${name}`,
				options: {},
				style: {
					text: `START\\n\\n${name}`,
					size: '7',
					color: ColorWhite,
					bgcolor: ColorBlack,
				},
				steps: [
					{
						down: [
							{
								actionId: 'connectionControl',
								options: {
									connection: id,
									command: 'START',
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
			presets[`connection_${name}_stop`] = {
				type: 'button',
				category: 'Connection Actions',
				name: `Stop ${name}`,
				options: {},
				style: {
					text: `STOP\\n\\n${name}`,
					size: '7',
					color: ColorWhite,
					bgcolor: ColorBlack,
				},
				steps: [
					{
						down: [
							{
								actionId: 'connectionControl',
								options: {
									connection: id,
									command: 'STOP',
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
			presets[`connection_${name}_status`] = {
				type: 'button',
				category: 'Connection Status',
				name: `Status ${name}`,
				options: {},
				style: {
					text: `${name}\\n\\n$(birddog-cloud:connection_status_${variableName})`,
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

	if (this.states.recordings) {
		this.states.recordings.forEach((recording) => {
			let id = recording.id
			let name = recording.parameters.input
			let variableName = name.replace(/[\W]/gi, '_')

			presets[`recording_${name}_start`] = {
				type: 'button',
				category: 'Recording Actions',
				name: `Start ${name}`,
				options: {},
				style: {
					text: `START\\n\\n${name}`,
					size: '7',
					color: ColorWhite,
					bgcolor: ColorBlack,
				},
				steps: [
					{
						down: [
							{
								actionId: 'recordingControl',
								options: {
									recordings: [id],
									command: 'START',
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [],
			}
			presets[`recording_${name}_stop`] = {
				type: 'button',
				category: 'Recording Actions',
				name: `Stop ${name}`,
				options: {},
				style: {
					text: `STOP\\n\\n${name}`,
					size: '7',
					color: ColorWhite,
					bgcolor: ColorBlack,
				},
				steps: [
					{
						down: [
							{
								actionId: 'recordingControl',
								options: {
									recordings: [id],
									command: 'STOP',
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [],
			}
			presets[`recording_${name}_status`] = {
				type: 'button',
				category: 'Recording Status',
				name: `Status ${name}`,
				options: {},
				style: {
					text: `${name}\\n\\n$(birddog-cloud:recording_status_${variableName})`,
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
						feedbackId: 'recordingActive',
						options: {
							recording: `${id}`,
						},
						style: {
							bgcolor: ColorRed,
						},
					},
				],
			}
		})
	}

	if (this.choices.presenters) {
		this.choices.presenters.forEach((presenter) => {
			let id = presenter.id
			let name = presenter.label

			presets[`presenter_${name}_main_full`] = {
				type: 'button',
				category: 'Presenter Layout Control',
				name: `Presenter ${name} Main Full`,
				options: {},
				style: {
					text: `${name}\\n\\nMAIN`,
					size: '7',
					color: ColorWhite,
					bgcolor: ColorBlack,
				},
				steps: [
					{
						down: [
							{
								actionId: 'presenterLayout',
								options: {
									connection: id,
									layout: 'setFullscreenMain',
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'presenterLayout',
						options: {
							connection: `${id}`,
							layout: 'setFullscreenMain',
						},
						style: {
							bgcolor: ColorGreen,
						},
					},
				],
			}
			presets[`presenter_${name}_video_full`] = {
				type: 'button',
				category: 'Presenter Layout Control',
				name: `Presenter ${name} Video Full`,
				options: {},
				style: {
					text: `${name}\\n\\nVIDEO`,
					size: '7',
					color: ColorWhite,
					bgcolor: ColorBlack,
				},
				steps: [
					{
						down: [
							{
								actionId: 'presenterLayout',
								options: {
									connection: id,
									layout: 'setFullscreenVideo',
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'presenterLayout',
						options: {
							connection: `${id}`,
							layout: 'setFullscreenVideo',
						},
						style: {
							bgcolor: ColorGreen,
						},
					},
				],
			}
			presets[`presenter_${name}_video_mix`] = {
				type: 'button',
				category: 'Presenter Layout Control',
				name: `Presenter ${name} Video Mix`,
				options: {},
				style: {
					text: `${name}\\n\\nMIX SOURCES`,
					size: '7',
					color: ColorWhite,
					bgcolor: ColorBlack,
				},
				steps: [
					{
						down: [
							{
								actionId: 'presenterLayout',
								options: {
									connection: id,
									layout: 'setMixed',
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'presenterLayout',
						options: {
							connection: `${id}`,
							layout: 'setMixed',
						},
						style: {
							bgcolor: ColorGreen,
						},
					},
				],
			}
		})
	}

	return presets
}
