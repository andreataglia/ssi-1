'use-strict'
const statusRegistry = require('../contracts/credentialStatusRegistry')
const VerifiableCredential = require('./VerifiableCredential.js')
const TrustedContactsList = require('./TrustedContactsList')

class VerifiableCredentialStatus {
  //takes a VerifiableCredential object as param
  constructor(vc, tcl) {
    if (!vc instanceof VerifiableCredential) {
      throw "vc needs to be a VerifiableCredential object"
    }
    if (!tcl instanceof TrustedContactsList) {
      throw "tcl needs to be a TrustedContactsList"
    }
    this.vc = vc
    this.tcl = tcl
    this.status = {}
    console.log(this.vc)
    console.log(this.tcl)
  }

  checkExpiry() {
    if (this.vc.exp < (new Date().getTime())) {
      this.status.exp = true
    } else {
      this.status.exp = false
    }
  }

  async checkSubjectEntity() {
    this.status.sub = await this.tcl.resolveEntity(this.vc.iss)
  }

  //check if issuer is in TCL
  async checkIssuerEntity() {
    this.status.ent = await this.tcl.resolveEntity(this.vc.iss)
  }

  checkSenderSubMatch(sender) {
    if (this.vc.sub == sender) {
      this.status.sender = true
    } else {
      this.status.sender = false
    }
  }

  async checkRevocationStatus() {
    this.status.csl = await statusRegistry.getCredentialStatus(this.vc.iss, this.vc.csl.id)
  }

  getStatus() {
    return this.status
  }

}

module.exports = VerifiableCredentialStatus;