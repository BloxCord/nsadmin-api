'use strict'
const statusService = require('../../services/status')

exports.validate = method => {
    switch (method) {
        case 'getStatus':
            return []
    }
}

exports.getStatus = async (req, res) => {
    res.json(statusService.getStatus())
}
