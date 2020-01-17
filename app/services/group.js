'use strict'
const roblox = require('noblox.js')
const createError = require('http-errors')
const pluralize = require('pluralize')
const axios = require('axios')

const trelloService = require('./trello')

const timeHelper = require('../helpers/time')

const DiscordMessageJob = require('../jobs/discord-message')

exports.suspend = async (groupId, userId, options) => {
    const rank = await exports.getRank(groupId, userId)
    if (rank === 2) throw createError(409, 'User is already suspended')
    if (rank >= 200 || rank === 99 || rank === 103) throw createError(403, 'User is unsuspendable')
    const boardId = await trelloService.getIdFromBoardName('[NS] Ongoing Suspensions')
    const listId = await trelloService.getIdFromListName(boardId, 'Current')
    const cards = await trelloService.getCards(listId, {fields: 'name'})
    for (const card of cards) {
        if (parseInt(card.name) === userId) throw createError(409, 'User is already suspended')
    }
    if (rank > 0 && rank !== 2) {
        await roblox.setRank(groupId, userId, 2)
    }
    await trelloService.postCard({
        idList: listId,
        name: userId.toString(),
        desc: JSON.stringify({
            rank: rank,
            rankback: options.rankback,
            duration: options.duration,
            by: options.by,
            reason: options.reason,
            at: timeHelper.getUnix()
        })
    })
    const [username, byUsername] = await Promise.all([roblox.getUsernameFromId(userId), roblox
        .getUsernameFromId(options.by)])
    const days = options.duration / 86400
    await (new DiscordMessageJob()).perform('log', `**${byUsername}** suspended **${username}** for **` +
        `${days} ${pluralize('day', days)}** with reason "*${options.reason}*"`)
}

exports.getRank = async (groupId, userId) => {
    return await roblox.getRankInGroup(groupId, userId)
}

exports.promote = async (groupId, userId, by) => {
    const rank = await exports.getRank(groupId, userId)
    if (rank === 0) throw createError(403, 'Can only promote group members')
    if (rank >= 100) throw createError(403, 'Can\'t promote MRs or higher')
    const username = await roblox.getUsernameFromId(userId)
    const roles = await roblox.changeRank(groupId, userId, rank === 1 ? 2 : 1)
    if (by) {
        const byUsername = await roblox.getUsernameFromId(by)
        await (new DiscordMessageJob()).perform('log', `**${byUsername}** promoted **${username}** ` +
            `from **${roles.oldRole.name}** to **${roles.newRole.name}**`)
    } else {
        await (new DiscordMessageJob()).perform('log', `Promoted **${username}** from **` +
            `${roles.oldRole.name}** to **${roles.newRole.name}**`)
    }
    return roles
}

exports.getShout = async groupId => {
    return await roblox.getShout(groupId)
}

exports.getRole = async (groupId, userId) => {
    return await roblox.getRankNameInGroup(groupId, userId)
}

exports.getSuspensions = async () => {
    const boardId = await trelloService.getIdFromBoardName('[NS] Ongoing Suspensions')
    const listId = await trelloService.getIdFromListName(boardId, 'Current')
    const cards = await trelloService.getCards(listId, {fields: 'name,desc'})
    let suspensions = []
    for (const card of cards) {
        const suspension = JSON.parse(card.desc)
        suspension.userId = parseInt(card.name)
        await suspensions.push(suspension)
    }
    return suspensions
}

exports.getTrainings = async () => {
    const boardId = await trelloService.getIdFromBoardName('[NS] Training Scheduler')
    const listId = await trelloService.getIdFromListName(boardId, 'Scheduled')
    const cards = await trelloService.getCards(listId, {fields: 'name,desc'})
    let trainings = []
    for (const card of cards) {
        const training = JSON.parse(card.desc)
        training.id = parseInt(card.name)
        await trainings.push(training)
    }
    return trainings
}

exports.hostTraining = async options => {
    const boardId = await trelloService.getIdFromBoardName('[NS] Training Scheduler')
    const listId = await trelloService.getIdFromListName(boardId, 'Scheduled')
    const trainingId = await trelloService.getCardsNumOnBoard(boardId) + 1
    await trelloService.postCard({
        idList: listId,
        name: trainingId.toString(),
        desc: JSON.stringify({
            by: options.by,
            type: options.type,
            date: options.date,
            specialnotes: options.specialnotes,
            at: timeHelper.getUnix()
        })
    })
    return trainingId
}

exports.getExiles = async () => {
    const boardId = await trelloService.getIdFromBoardName('[NS] Ongoing Suspensions')
    const listId = await trelloService.getIdFromListName(boardId, 'Exiled')
    const cards = await trelloService.getCards(listId, {fields: 'name'})
    let exiles = []
    for (const card of cards) {
        await exiles.push({ userId: parseInt(card.name) })
    }
    return exiles
}

exports.getSuspension = async userId => {
    const boardId = await trelloService.getIdFromBoardName('[NS] Ongoing Suspensions')
    const listId = await trelloService.getIdFromListName(boardId, 'Current')
    const cards = await trelloService.getCards(listId, {fields: 'name,desc'})
    for (const card of cards) {
        const suspension = JSON.parse(card.desc)
        suspension.userId = parseInt(card.name)
        if (suspension.userId === userId) {
            return suspension
        }
    }
}

exports.getTraining = async trainingId => {
    const boardId = await trelloService.getIdFromBoardName('[NS] Training Scheduler')
    const listId = await trelloService.getIdFromListName(boardId, 'Scheduled')
    const cards = await trelloService.getCards(listId, {fields: 'name,desc'})
    for (const card of cards) {
        const training = JSON.parse(card.desc)
        training.id = parseInt(card.name)
        if (training.id === trainingId) {
            return training
        }
    }
}

exports.shout = async (groupId, by, message) => {
    const byUsername = await roblox.getUsernameFromId(by)
    await roblox.shout(groupId, message)
    if (message === '') {
        await (new DiscordMessageJob()).perform('log', `**${byUsername}** cleared the shout`)
    } else {
        await (new DiscordMessageJob()).perform('log', `**${byUsername}** shouted *"${message}"*`)
    }
}

exports.putTraining = async (trainingId, options) => {
    const boardId = await trelloService.getIdFromBoardName('[NS] Training Scheduler')
    const listId = await trelloService.getIdFromListName(boardId, 'Scheduled')
    const cards = await trelloService.getCards(listId, {fields: 'name,desc'})
    for (const card of cards) {
        if (parseInt(card.name) === trainingId) {
            const cardOptions = {}
            const trainingData = JSON.parse(card.desc)
            if (options.by) trainingData.by = options.by
            if (options.type) trainingData.type = options.type
            if (options.date) trainingData.date = options.date
            if (options.specialnotes) trainingData.specialnotes = options.specialnotes
            if (options.cancelled) {
                trainingData.cancelled = {
                    by: options.by,
                    reason: options.reason,
                    at: timeHelper.getUnix()
                }
                cardOptions.idList = await trelloService.getIdFromListName(boardId, 'Cancelled')
            }
            if (options.finished) {
                trainingData.finished = {
                    by: options.by,
                    at: timeHelper.getUnix()
                }
                cardOptions.idList = await trelloService.getIdFromListName(boardId, 'Finished')
            }
            cardOptions.desc = JSON.stringify(trainingData)
            return trelloService.putCard(card.id, cardOptions)
        }
    }
}

exports.putSuspension = async (userId, options) => {
    const boardId = await trelloService.getIdFromBoardName('[NS] Ongoing Suspensions')
    const listId = await trelloService.getIdFromListName(boardId, 'Current')
    const cards = await trelloService.getCards(listId, {fields: 'name,desc'})
    for (const card of cards) {
        if (parseInt(card.name) === userId) {
            const cardOptions = {}
            const suspensionData = JSON.parse(card.desc)
            if (options.by) suspensionData.by = options.by
            if (options.reason) suspensionData.reason = options.reason
            if (options.rankback) suspensionData.rankback = options.rankback
            if (options.cancelled) {
                suspensionData.cancelled = {
                    by: options.by,
                    reason: options.reason,
                    at: timeHelper.getUnix()
                }
                cardOptions.idList = await trelloService.getIdFromListName(boardId, 'Done')
            }
            if (options.extended) {
                let days = suspensionData.duration / 86400
                if (!suspensionData.extended) suspensionData.extended = []
                suspensionData.extended.forEach(extension => {
                    days += extension.duration / 86400
                })
                days += options.duration
                if (days < 1) throw createError(403, 'Insufficient amount of days')
                if (days > 7) throw createError(403, 'Too many days')
                suspensionData.extended.push({
                    by: options.by,
                    duration: options.duration * 86400,
                    reason: options.reason,
                    at: timeHelper.getUnix()
                })
            }
            cardOptions.desc = JSON.stringify(suspensionData)
            return trelloService.putCard(card.id, cardOptions)
        }
    }
}

exports.getGroup = async groupId => {
    return (await axios({
        method: 'get',
        url: `https://groups.roblox.com/v1/groups/${groupId}`
    })).data
}

exports.getFinishedSuspensions = async () => {
    const boardId = await trelloService.getIdFromBoardName('[NS] Ongoing Suspensions')
    const listId = await trelloService.getIdFromListName(boardId, 'Done')
    const cards = await trelloService.getCards(listId, {fields: 'name,desc'})
    let suspensions = []
    for (const card of cards) {
        const suspension = JSON.parse(card.desc)
        suspension.userId = parseInt(card.name)
        await suspensions.push(suspension)
    }
    return suspensions
}
