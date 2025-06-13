const express = require("express");
const { connectSession } = require("../controllers/session.controller");

const router = express.Router();

router.post("/connect", connectSession);

module.exports = router;
