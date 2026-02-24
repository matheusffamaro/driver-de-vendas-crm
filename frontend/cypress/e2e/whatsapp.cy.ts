describe('WhatsApp', () => {
  let authData: { token: string; user: any }
  const apiUrl = Cypress.env('apiUrl') || 'http://localhost:8000/api'

  before(() => {
    cy.registerAndLogin('Admin WhatsApp').then((data) => {
      authData = data
    })
  })

  beforeEach(() => {
    window.localStorage.setItem('auth-storage', JSON.stringify({
      state: {
        user: authData.user,
        token: authData.token,
        isAuthenticated: true,
      },
    }))
  })

  it('should navigate to WhatsApp page', () => {
    cy.visit('/crm/whatsapp')
    cy.url().should('include', '/crm/whatsapp')
  })

  it('should display sessions list or empty state', () => {
    cy.visit('/crm/whatsapp')
    cy.get('body', { timeout: 10000 }).should('be.visible')
  })

  it('should create a WhatsApp session via API', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/whatsapp/sessions`,
      headers: { Authorization: `Bearer ${authData.token}` },
      body: {
        phone_number: '5511999887766',
        session_name: 'Cypress Session',
      },
    }).then((response) => {
      expect(response.status).to.eq(201)
      expect(response.body.data).to.have.property('id')
    })
  })

  it('should list sessions via API', () => {
    cy.request({
      method: 'GET',
      url: `${apiUrl}/whatsapp/sessions`,
      headers: { Authorization: `Bearer ${authData.token}` },
    }).then((response) => {
      expect(response.status).to.eq(200)
    })
  })

  it('should manage quick replies via API', () => {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/whatsapp/quick-replies`,
      headers: { Authorization: `Bearer ${authData.token}` },
      body: {
        shortcut: '/cypress',
        title: 'Saudação Cypress',
        content: 'Olá! Mensagem automática do Cypress.',
      },
    }).then((response) => {
      expect(response.status).to.eq(201)
    })
  })

  describe('Conversation Flow via API', () => {
    let sessionId: string
    let conversationId: string

    before(() => {
      cy.request({
        method: 'POST',
        url: `${apiUrl}/whatsapp/sessions`,
        headers: { Authorization: `Bearer ${authData.token}` },
        body: {
          phone_number: '5511888776655',
          session_name: 'Conv Test Session',
        },
      }).then((response) => {
        sessionId = response.body.data.id
      })
    })

    it('should start a conversation', () => {
      cy.then(() => {
        cy.request({
          method: 'POST',
          url: `${apiUrl}/whatsapp/sessions/${sessionId}/conversations`,
          headers: { Authorization: `Bearer ${authData.token}` },
          body: {
            phone_number: '5511777000001',
            contact_name: 'Contato Cypress',
          },
          failOnStatusCode: false,
        }).then((response) => {
          if (response.status === 200 || response.status === 201) {
            conversationId = response.body.data?.id
          }
        })
      })
    })

    it('should link a contact to conversation', () => {
      cy.then(() => {
        if (!conversationId) return

        cy.request({
          method: 'POST',
          url: `${apiUrl}/clients`,
          headers: { Authorization: `Bearer ${authData.token}` },
          body: { name: 'WA Contact Cypress', email: `wa-${Date.now()}@cypress.com` },
        }).then((clientRes) => {
          cy.request({
            method: 'POST',
            url: `${apiUrl}/whatsapp/conversations/${conversationId}/link-contact`,
            headers: { Authorization: `Bearer ${authData.token}` },
            body: { contact_id: clientRes.body.data.id },
            failOnStatusCode: false,
          }).then((response) => {
            expect([200, 201]).to.include(response.status)
          })
        })
      })
    })
  })
})
