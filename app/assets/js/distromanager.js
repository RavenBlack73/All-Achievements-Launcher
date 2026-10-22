const { DistributionAPI, HeliosServer } = require('helios-core/common')
const { Type } = require('helios-distribution-types')
const fs = require('fs-extra')
const path = require('path')

const ConfigManager = require('./configmanager')
const { NEOFORGE_SERVER_ID, MINECRAFT_VERSION, NEOFORGE_VERSION } = require('./neoforgeprofile')
const modrinthIndex = require('../../../modrinth.index.json')

const GAME_SERVER_NAME = 'All Achievements'
const GAME_SERVER_ADDRESS = 'AllGameAchievements.exaroton.me:43039'

const RAVENS_MUSIC = {
    id: 'ravens_music-1.4.0-neoforge-26.3.jar',
    name: 'Raven\'s Music',
    sha1: '7aeb19058027121c4a9a8ddc805c33044d9e9d1b',
    size: 462757656
}

exports.REMOTE_DISTRO_URL = 'https://raw.githubusercontent.com/RavenBlack73/All-Achievements-Launcher/main/distribution.json'

const api = new DistributionAPI(
    ConfigManager.getLauncherDirectory(),
    null, // Injected forcefully by the preloader.
    null, // Injected forcefully by the preloader.
    exports.REMOTE_DISTRO_URL,
    false
)

function getNeoForgeMods() {
    if(modrinthIndex.dependencies?.minecraft !== MINECRAFT_VERSION
        || modrinthIndex.dependencies?.neoforge !== NEOFORGE_VERSION) {
        throw new Error(`Modrinth index must target Minecraft ${MINECRAFT_VERSION} and NeoForge ${NEOFORGE_VERSION}.`)
    }

    const modrinthMods = modrinthIndex.files
        .filter(file => file.env?.client === 'required')
        .map(file => {
            const fileName = path.basename(file.path)
            const sha1 = file.hashes?.sha1
            const url = file.downloads?.[0]
            if(!file.path.startsWith('mods/')
                || file.path.split(/[\\/]/).includes('..')
                || !/^[a-f0-9]{40}$/i.test(sha1 || '')
                || !Number.isSafeInteger(file.fileSize)
                || typeof url !== 'string'
                || new URL(url).hostname !== 'cdn.modrinth.com') {
                throw new Error(`Invalid required client mod entry in Modrinth index: ${file.path}.`)
            }

            return {
                id: `modrinth:${sha1}`,
                name: fileName.replace(/\.jar$/i, ''),
                type: Type.File,
                neoforgeMod: true,
                sha1,
                required: {
                    value: true,
                    def: true
                },
                artifact: {
                    size: file.fileSize,
                    path: file.path,
                    url
                }
            }
        })

    return [...modrinthMods, {
        id: `local:${RAVENS_MUSIC.id}`,
        name: RAVENS_MUSIC.name,
        type: Type.File,
        neoforgeMod: true,
        bundledFile: RAVENS_MUSIC.id,
        sha1: RAVENS_MUSIC.sha1,
        required: {
            value: true,
            def: true
        },
        artifact: {
            size: RAVENS_MUSIC.size,
            path: `mods/${RAVENS_MUSIC.id}`
        }
    }]
}

async function addNeoForgeProfile(distribution) {
    let rawServer = distribution.rawDistribution.servers.find(server => server.id === NEOFORGE_SERVER_ID)
    if(rawServer == null) {
        rawServer = {
            id: NEOFORGE_SERVER_ID,
            name: GAME_SERVER_NAME,
            description: `${GAME_SERVER_NAME} - Minecraft ${MINECRAFT_VERSION} with NeoForge ${NEOFORGE_VERSION}.`,
            icon: 'assets/images/SealCircle.png',
            version: NEOFORGE_VERSION,
            address: GAME_SERVER_ADDRESS,
            minecraftVersion: MINECRAFT_VERSION,
            javaOptions: {
                supported: '25.x',
                suggestedMajor: 25
            },
            mainServer: false,
            autoconnect: true,
            modules: []
        }

        distribution.rawDistribution.servers.push(rawServer)
    }

    rawServer.name = GAME_SERVER_NAME
    rawServer.description = `${GAME_SERVER_NAME} - Minecraft ${MINECRAFT_VERSION} with NeoForge ${NEOFORGE_VERSION}.`
    rawServer.address = GAME_SERVER_ADDRESS
    rawServer.autoconnect = true
    rawServer.modules = getNeoForgeMods()
    const existingServerIndex = distribution.servers.findIndex(server => server.rawServer.id === NEOFORGE_SERVER_ID)
    const server = new HeliosServer(rawServer, api.commonDir, api.instanceDir)
    if(existingServerIndex === -1) {
        distribution.servers.push(server)
    } else {
        distribution.servers[existingServerIndex] = server
    }

    const distributionFile = api.isDevMode() ? 'distribution_dev.json' : 'distribution.json'
    await fs.writeJson(path.join(ConfigManager.getLauncherDirectory(), distributionFile), distribution.rawDistribution)
    return distribution
}

const getDistribution = api.getDistribution.bind(api)
api.getDistribution = async function() {
    return addNeoForgeProfile(await getDistribution())
}

const refreshDistributionOrFallback = api.refreshDistributionOrFallback.bind(api)
api.refreshDistributionOrFallback = async function() {
    return addNeoForgeProfile(await refreshDistributionOrFallback())
}

exports.DistroAPI = api
exports.NEOFORGE_SERVER_ID = NEOFORGE_SERVER_ID