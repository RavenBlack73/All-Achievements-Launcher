const { spawn } = require('child_process')
const fs = require('fs-extra')
const path = require('path')
const { LoggerUtil } = require('helios-core')
const { validateLocalFile } = require('helios-core/common')
const { downloadFile } = require('helios-core/dl')

const {
    MINECRAFT_VERSION,
    NEOFORGE_VERSION,
    NEOFORGE_VERSION_ID
} = require('./neoforgeprofile')

const logger = LoggerUtil.getLogger('NeoForgeInstaller')
const INSTALLER_URL = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${NEOFORGE_VERSION}/neoforge-${NEOFORGE_VERSION}-installer.jar`
const INSTALLER_SHA1 = '66b8a37f1487026cb1f97b7fdf17955851ad4604'

function runInstaller(javaExecutable, installerPath, commonDirectory) {
    return new Promise((resolve, reject) => {
        const child = spawn(javaExecutable, [
            '-jar',
            installerPath,
            '--installClient',
            commonDirectory
        ], {
            cwd: commonDirectory,
            windowsHide: true
        })

        let stderr = ''
        child.stdout.setEncoding('utf8')
        child.stderr.setEncoding('utf8')
        child.stdout.on('data', data => {
            data.trim().split('\n').forEach(line => logger.info(`[Installer] ${line}`))
        })
        child.stderr.on('data', data => {
            stderr = (stderr + data).slice(-4000)
            data.trim().split('\n').forEach(line => logger.warn(`[Installer] ${line}`))
        })
        child.on('error', reject)
        child.on('close', code => {
            if(code === 0) {
                resolve()
            } else {
                reject(new Error(`NeoForge installer exited with code ${code}.${stderr ? ` ${stderr.trim()}` : ''}`))
            }
        })
    })
}

async function readInstalledProfile(commonDirectory) {
    const profilePath = path.join(
        commonDirectory,
        'versions',
        NEOFORGE_VERSION_ID,
        `${NEOFORGE_VERSION_ID}.json`
    )
    if(!await fs.pathExists(profilePath)) {
        return null
    }

    return await fs.readJson(profilePath)
}

async function areProfileLibrariesInstalled(commonDirectory, profile) {
    if(!Array.isArray(profile.libraries)) {
        return false
    }

    for(const library of profile.libraries) {
        const artifactPath = library.downloads?.artifact?.path
        if(typeof artifactPath !== 'string' || !await fs.pathExists(path.join(commonDirectory, 'libraries', artifactPath))) {
            return false
        }
    }
    return true
}

exports.installNeoForgeClient = async function(javaExecutable, commonDirectory) {
    await fs.ensureDir(commonDirectory)
    const launcherProfilesPath = path.join(commonDirectory, 'launcher_profiles.json')
    const microsoftStoreProfilesPath = path.join(commonDirectory, 'launcher_profiles_microsoft_store.json')
    if(!await fs.pathExists(launcherProfilesPath) && !await fs.pathExists(microsoftStoreProfilesPath)) {
        await fs.writeJson(launcherProfilesPath, { profiles: {} })
    }

    const installerPath = path.join(
        commonDirectory,
        'libraries',
        'net',
        'neoforged',
        'neoforge',
        NEOFORGE_VERSION,
        `neoforge-${NEOFORGE_VERSION}-installer.jar`
    )

    if(!await validateLocalFile(installerPath, 'sha1', INSTALLER_SHA1)) {
        await downloadFile(INSTALLER_URL, installerPath)
        if(!await validateLocalFile(installerPath, 'sha1', INSTALLER_SHA1)) {
            throw new Error('The downloaded NeoForge installer failed its SHA-1 validation.')
        }
    }

    let profile = await readInstalledProfile(commonDirectory)
    if(profile == null || profile.inheritsFrom !== MINECRAFT_VERSION || !await areProfileLibrariesInstalled(commonDirectory, profile)) {
        logger.info(`Installing NeoForge ${NEOFORGE_VERSION} for Minecraft ${MINECRAFT_VERSION}.`)
        await runInstaller(javaExecutable, installerPath, commonDirectory)
        profile = await readInstalledProfile(commonDirectory)
    }

    if(profile == null || profile.inheritsFrom !== MINECRAFT_VERSION || !await areProfileLibrariesInstalled(commonDirectory, profile)) {
        throw new Error(`NeoForge ${NEOFORGE_VERSION} did not install a complete client profile.`)
    }

    return profile
}
