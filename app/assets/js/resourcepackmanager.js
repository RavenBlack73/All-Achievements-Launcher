const fs = require('fs-extra')
const path = require('path')
const { validateLocalFile } = require('helios-core/common')
const { MINECRAFT_VERSION, NEOFORGE_VERSION } = require('./neoforgeprofile')
const packIndex = require('../../../pack.index.json')

const RESOURCE_PACK_ORDER = [
    'vanilla',
    'mod_resources',
    'file/Fresh Textures v2.0.1.1.zip',
    'file/FreshAnimations_v1.11.1_26.1+.zip',
    'file/FA+All_Extensions-v1.9.2.zip',
    'file/FreshTextures+FA 1.0.6.zip',
    'file/Better-Leaves-9.6.zip',
    'file/Fullbright-UB-26.3 fub-7.0.zip',
    'file/Dark Smooth GUI 26.3.x blue-3D94FF-5EA6FF-0049A3-00316E.zip'
]

function getResourcePacks() {
    if(packIndex.dependencies?.minecraft !== MINECRAFT_VERSION
        || packIndex.dependencies?.neoforge !== NEOFORGE_VERSION) {
        throw new Error(`Resource pack index must target Minecraft ${MINECRAFT_VERSION} and NeoForge ${NEOFORGE_VERSION}.`)
    }

    const indexedPacks = new Map(packIndex.files.map(file => [file.path, file]))
    return RESOURCE_PACK_ORDER.slice(2).map(packId => {
        const packPath = `resourcepacks/${packId.slice('file/'.length)}`
        const file = indexedPacks.get(packPath)
        const sha1 = file?.hashes?.sha1
        const url = file?.downloads?.[0]

        if(file == null
            || file.env?.client !== 'required'
            || file.path.split(/[\\/]/).includes('..')
            || !/^[a-f0-9]{40}$/i.test(sha1 || '')
            || !Number.isSafeInteger(file.fileSize)
            || typeof url !== 'string'
            || new URL(url).hostname !== 'cdn.modrinth.com') {
            throw new Error(`Invalid required client resource pack entry in pack index: ${packPath}.`)
        }

        return {
            id: `modrinth:${sha1}`,
            name: path.basename(file.path),
            sha1,
            size: file.fileSize,
            url,
            path: file.path,
            packId
        }
    })
}

async function getInvalidResourcePackAssets(instanceDirectory, serverId) {
    const instancePath = path.join(instanceDirectory, serverId)
    const invalidAssets = []

    for(const pack of getResourcePacks()) {
        const localPath = path.join(instancePath, pack.path)
        if(!await validateLocalFile(localPath, 'sha1', pack.sha1)) {
            invalidAssets.push({
                id: pack.id,
                hash: pack.sha1,
                algo: 'sha1',
                size: pack.size,
                url: pack.url,
                path: localPath
            })
        }
    }

    return invalidAssets
}

async function applyResourcePackOrder(instanceDirectory, serverId) {
    const instancePath = path.join(instanceDirectory, serverId)
    const optionsPath = path.join(instancePath, 'options.txt')
    let options = ''

    try {
        options = await fs.readFile(optionsPath, 'utf8')
    } catch(err) {
        if(err.code !== 'ENOENT') {
            throw err
        }
    }

    const newline = options.includes('\r\n') ? '\r\n' : '\n'
    const lines = options.length > 0 ? options.split(/\r?\n/) : []
    const resourcePackLine = `resourcePacks:${JSON.stringify(RESOURCE_PACK_ORDER)}`
    const existingLine = lines.findIndex(line => line.startsWith('resourcePacks:'))

    if(existingLine === -1) {
        lines.push(resourcePackLine)
    } else {
        lines[existingLine] = resourcePackLine
        for(let i = lines.length - 1; i > existingLine; i--) {
            if(lines[i].startsWith('resourcePacks:')) {
                lines.splice(i, 1)
            }
        }
    }

    await fs.ensureDir(instancePath)
    await fs.writeFile(optionsPath, lines.join(newline), 'utf8')
}

exports.getResourcePacks = getResourcePacks
exports.getInvalidResourcePackAssets = getInvalidResourcePackAssets
exports.applyResourcePackOrder = applyResourcePackOrder
