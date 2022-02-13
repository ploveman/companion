import * as SocketIOClient from 'socket.io-client'
import { literal } from '../util'
import { ResultCallback } from '../host-api/versions'
import { EncodeIsVisible, SomeCompanionInputField } from './v0'

/**
 * Signature for the handler functions
 */
type HandlerFunction<T extends (...args: any) => any> = (data: Parameters<T>[0]) => Promise<ReturnType<T>>

type HandlerFunctionOrNever<T> = T extends (...args: any) => any ? HandlerFunction<T> : never

/** Map of handler functions */
export type EventHandlers<T extends object> = {
	[K in keyof T]: HandlerFunctionOrNever<T[K]>
}

/** Subscribe to all the events defined in the handlers, and wrap with safety and logging */
export function listenToEvents<T extends object>(socket: SocketIOClient.Socket<T>, handlers: EventHandlers<T>): void {
	// const logger = createChildLogger(`module/${connectionId}`);

	for (const [event, handler] of Object.entries(handlers)) {
		socket.on(event as any, async (msg: any, cb: ResultCallback<any>) => {
			if (!msg || typeof msg !== 'object') {
				console.warn(`Received malformed message object "${event}"`)
				return // Ignore messages without correct structure
			}
			if (cb && typeof cb !== 'function') {
				console.warn(`Received malformed callback "${event}"`)
				return // Ignore messages without correct structure
			}

			try {
				// Run it
				const handler2 = handler as HandlerFunction<(msg: any) => any>
				const result = await handler2(msg)

				if (cb) cb(null, result)
			} catch (e: any) {
				console.error(`Command failed: ${e}`)
				if (cb) cb(e?.toString() ?? JSON.stringify(e), undefined)
			}
		})
	}
}

export function serializeIsVisibleFn<T extends SomeCompanionInputField>(options: T[]): EncodeIsVisible<T>[] {
	return options.map((option) => {
		if ('isVisible' in option) {
			if (typeof option.isVisible === 'function') {
				return {
					...option,
					isVisibleFn: option.isVisible.toString(),
					isVisible: undefined,
				}
			}
		}

		// ignore any existing `isVisibleFn` to avoid code injection
		return {
			...option,
			isVisibleFn: undefined,
		}
	})
}
