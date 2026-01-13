/* eslint-disable no-console */
// eslint-disable-next-line import/no-unresolved
import { world, system } from '@minecraft/server'

/**
 * The Player class defines an entity controlled by a human player.
 * @typedef {import('@minecraft/server').Player} Player
 */

const BRAILLE_OFFSET = 10240

console.warn('[DEBUGPACK] Loaded debug pack script ✅')

/**
 * Offsets every non-space codepoint in a string by `delta` (spaces are preserved).
 * @param {string} input
 * @param {number} delta
 * @returns {string}
 */
function offsetString(input, delta) {
    let out = ''
    for (const ch of String(input ?? '')) {
        if (ch === ' ') {
            out += ' '
            continue
        }
        out += String.fromCodePoint(ch.codePointAt(0) + delta)
    }
    return out
}

/**
 * True if the message contains either the literal command or its +10240-offset encoded variant.
 * @param {string} message
 * @param {string} command
 * @returns {boolean}
 */
function messageContainsCommand(message, command) {
    const msg = String(message ?? '').normalize('NFKC')
    return msg.includes(offsetString(command, 0)) || msg.includes(offsetString(command, BRAILLE_OFFSET))
}

/**
 * Turns Minecraft's day tick number into a 24 based hour time string (e.g. 23:59).
 * @param {number} time The game tick time. Must be coercible to an integer between 0 and 24000.
 * @returns {string|undefined} The translated time of day value.
 */
function translateTimeOfDay(time) {
    const safeTime = parseInt(time, 10)
    if (!safeTime || safeTime > 24000 || safeTime < 0) return undefined

    let minecraftTime = 6 + (safeTime / 24000) * 24
    if (minecraftTime > 24) minecraftTime -= 24

    const hour = Math.floor(minecraftTime)
    const minute = Math.floor((minecraftTime - hour) * 60)
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
}

/**
 * Starts the interval command that shows the debug menu for a player.
 * @param {Player} player
 * @returns {number} interval handle usable with system.clearRun(handle)
 */
function showDebugInfo(player) {
    return system.runInterval(() => {
        const { location } = player

        const playerSpawn = player.getSpawnPoint()
        let playerSpawnString = ''
        if (playerSpawn) {
            const spawnDimension = playerSpawn.dimension.id.substring(10)
            playerSpawnString = `${spawnDimension} (${playerSpawn?.x}, ${playerSpawn?.y}, ${playerSpawn?.z})`
        } else {
            const defaultSpawn = world.getDefaultSpawnLocation()
            playerSpawnString = `World spawn: (${defaultSpawn.x}, ${defaultSpawn.z})`
        }

        const playerBlock = {
            x: Math.floor(location.x),
            y: Math.floor(location.y),
            z: Math.floor(location.z)
        }
        const playerChunk = {
            x: Math.floor(playerBlock.x / 16),
            y: Math.floor(playerBlock.y / 16),
            z: Math.floor(playerBlock.z / 16)
        }
        const playerChunkString = `${playerChunk.x}, ${playerChunk.y}, ${playerChunk.z}`

        const playerChunkPosition = {
            x: playerBlock.x % 16,
            y: playerBlock.y % 16,
            z: playerBlock.z % 16
        }
        const playerChunkPositionString = `${playerChunkPosition.x}, ${playerChunkPosition.y}, ${playerChunkPosition.z}`

        const velocity = player.getVelocity()
        const rotation = player.getRotation()
        const day = Math.floor(world.getAbsoluteTime() / 24000)

        const block = player.getBlockFromViewDirection()
        let blockString = ''
        if (block?.block.isValid) {
            if (block.block.isWaterlogged) blockString = 'waterlogged '
            blockString += block.block.typeId.startsWith('minecraft:')
                ? block.block.typeId.substring(10)
                : block.block.typeId
            blockString += ` (${block.block.x}, ${block.block.y}, ${block.block.z})`
            const redstonePower = block.block.getRedstonePower()
            if (redstonePower) blockString += `, Redstone Power: ${redstonePower}`
        } else {
            blockString = 'None'
        }

        const entity = player.getEntitiesFromViewDirection()[0]
        let entityString = ''
        if (entity?.entity.typeId) {
            entityString += entity.entity.typeId.startsWith('minecraft:')
                ? entity.entity.typeId.substring(10)
                : entity.entity.typeId

            if (entity?.entity.nameTag) entityString += ` "${entity.entity.nameTag}" `

            const loc = entity.entity.location
            entityString += ` (${loc.x.toFixed(1)}, ${loc.y.toFixed(1)}, ${loc.z.toFixed(1)})`

            const health = entity?.entity.getComponent('minecraft:health')
            if (health) entityString += `, Health: ${health.currentValue} `
        } else {
            entityString = 'None'
        }

        let moonPhaseString = ''
        switch (world.getMoonPhase()) {
            case 1: moonPhaseString = 'Waning Gibbous'; break
            case 2: moonPhaseString = 'First Quarter'; break
            case 3: moonPhaseString = 'Waning Crescent'; break
            case 4: moonPhaseString = 'New Moon'; break
            case 5: moonPhaseString = 'Waxing Crescent'; break
            case 6: moonPhaseString = 'Last Quarter'; break
            case 7: moonPhaseString = 'Waxing Gibbous'; break
            default: moonPhaseString = 'Full Moon'; break
        }

        player.onScreenDisplay.setActionBar(
            // eslint-disable-next-line prettier/prettier
            `${player.name}                                                                                             
Player Spawn Point: ${playerSpawnString}
Position / Velocity
X: ${location.x.toFixed(2).padStart(8, ' ')} / ${velocity.x.toFixed(6)}
Y: ${location.y.toFixed(2).padStart(8, ' ')} / ${velocity.y.toFixed(6)}
Z: ${location.z.toFixed(2).padStart(8, ' ')} / ${velocity.z.toFixed(6)}
Chunk (${playerChunkPositionString}) in (${playerChunkString})

Bearing: ${(rotation.y + 180).toFixed(1).padStart(5, '0')}°, Elevation: ${-rotation.x.toFixed(1)}°
Looking at
  Block:  ${blockString}
  Entity: ${entityString}

Dimension: ${player.dimension.id.substring(10)}
Weather:   ${world.getDimension(player.dimension.id).getWeather()}
Day ${day} ${translateTimeOfDay(world.getTimeOfDay())}
Moon Phase: ${moonPhaseString}




 `
        )
    })
}

/**
 * Prefer a stable per-player key.
 * `player.id` exists in modern Script API; fall back to name if needed.
 * @param {Player} player
 * @returns {string}
 */
function playerKey(player) {
    return String(player?.id ?? player?.name ?? '')
}

// Per-player interval handles
/** @type {Map<string, number>} */
const activeDebugIntervals = new Map()

function enableDebugForPlayer(player) {
    const key = playerKey(player)
    if (!key) return

    if (activeDebugIntervals.has(key)) {
        system.run(() => player.onScreenDisplay.setActionBar('Debug already enabled'))
        return
    }

    const handle = showDebugInfo(player)
    activeDebugIntervals.set(key, handle)
    system.run(() => player.onScreenDisplay.setActionBar('Debug Menu Opened'))
}

function disableDebugForPlayer(player) {
    const key = playerKey(player)
    if (!key) return

    const handle = activeDebugIntervals.get(key)
    if (handle !== undefined) {
        system.clearRun(handle)
        activeDebugIntervals.delete(key)
    }

    system.run(() => player.onScreenDisplay.setActionBar('Debug Menu Closed'))
}

// Optional cleanup when players leave
world.afterEvents.playerLeave.subscribe((ev) => {
    const key = String(ev.playerId ?? '')
    const handle = activeDebugIntervals.get(key)
    if (handle !== undefined) {
        system.clearRun(handle)
        activeDebugIntervals.delete(key)
    }
})

const chatEvent = world?.beforeEvents?.chatSend ?? null
if (!chatEvent) {
    console.error('[DEBUGPACK] world.beforeEvents.chatSend not available — cannot subscribe ❌')
} else {
    try {
        chatEvent.subscribe((eventData) => {
            const player = eventData.sender

            if (messageContainsCommand(eventData.message, '?debug on')) {
                enableDebugForPlayer(player)
                // eslint-disable-next-line no-param-reassign
                eventData.cancel = true
                return
            }

            if (messageContainsCommand(eventData.message, '?debug off')) {
                disableDebugForPlayer(player)
                // eslint-disable-next-line no-param-reassign
                eventData.cancel = true
            }
        })

        console.warn('[DEBUGPACK] Subscribed to chatSend ✅')
    } catch (e) {
        console.error(`[DEBUGPACK] Failed to subscribe to chatSend: ${e}\n${e?.stack ?? ''}`)
    }
}
