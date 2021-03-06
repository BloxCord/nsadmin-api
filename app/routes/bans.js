'use strict'
const express = require('express')
const router = express.Router()

const banController = require('../controllers/v1/ban')

const { handleValidationResult } = require('../middlewares/error')
const { parseParams } = require('../middlewares/request')
const { authenticate } = require('../middlewares/auth')

router.get('/', banController.validate('getBans'), handleValidationResult, authenticate, banController.getBans)

router.post('/', banController.validate('ban'), handleValidationResult, authenticate, banController.ban)

router.put('/:userId', banController.validate('putBan'), handleValidationResult, authenticate, parseParams,
    banController.putBan)

module.exports = router
