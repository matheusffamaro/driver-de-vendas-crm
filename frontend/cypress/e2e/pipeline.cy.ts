describe('Pipeline Management', () => {
  let authData: { token: string; user: any }
  const apiUrl = Cypress.env('apiUrl') || 'http://localhost:8000/api'

  before(() => {
    cy.registerAndLogin('Admin Pipeline').then((data) => {
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

  it('should navigate to pipeline page', () => {
    cy.visit('/crm/pipeline')
    cy.url().should('include', '/crm/pipeline')
  })

  it('should display pipeline stages (kanban view)', () => {
    cy.visit('/crm/pipeline')
    cy.get('[class*="stage"], [class*="column"], [data-testid*="stage"]', { timeout: 15000 })
      .should('have.length.greaterThan', 0)
  })

  it('should create a new card via UI', () => {
    cy.visit('/crm/pipeline')

    cy.contains(/novo|adicionar|criar|\+/i).first().click()

    cy.get('input[name="title"]').type('Negócio Cypress')

    if (Cypress.$('input[name="value"]').length) {
      cy.get('input[name="value"]').clear().type('5000')
    }

    cy.get('button[type="submit"]').click()

    cy.contains(/sucesso|criado|salvo/i, { timeout: 10000 }).should('be.visible')
  })

  describe('Full Pipeline Card Flow via API + UI Verification', () => {
    let pipelineId: string
    let stages: any[]
    let clientId: string
    let productId: string
    let cardId: string

    before(() => {
      // Get or create pipeline
      cy.request({
        method: 'GET',
        url: `${apiUrl}/pipelines`,
        headers: { Authorization: `Bearer ${authData.token}` },
      }).then((response) => {
        const pipelines = response.body.data.data || response.body.data
        if (pipelines.length > 0) {
          pipelineId = pipelines[0].id

          // Get stages
          return cy.request({
            method: 'GET',
            url: `${apiUrl}/pipelines/${pipelineId}`,
            headers: { Authorization: `Bearer ${authData.token}` },
          }).then((pipeRes) => {
            stages = pipeRes.body.data.stages || []
          })
        }
      })

      // Create test client
      cy.request({
        method: 'POST',
        url: `${apiUrl}/clients`,
        headers: { Authorization: `Bearer ${authData.token}` },
        body: { name: 'Cliente Pipeline Cypress', email: `pipeline-${Date.now()}@cypress.com` },
      }).then((response) => {
        clientId = response.body.data.id
      })

      // Create test product
      cy.request({
        method: 'POST',
        url: `${apiUrl}/products`,
        headers: { Authorization: `Bearer ${authData.token}` },
        body: { name: 'Produto Pipeline Cypress', price: 300.00 },
      }).then((response) => {
        productId = response.body.data.id
      })
    })

    it('should create card with seller assignment', () => {
      cy.then(() => {
        if (!pipelineId || !stages?.length) return

        cy.request({
          method: 'POST',
          url: `${apiUrl}/pipelines/${pipelineId}/cards`,
          headers: { Authorization: `Bearer ${authData.token}` },
          body: {
            title: 'Venda Completa Cypress',
            stage_id: stages[0].id,
            contact_id: clientId,
            assigned_to: authData.user.id,
            value: 3000.00,
            priority: 'high',
          },
        }).then((response) => {
          expect(response.status).to.eq(201)
          cardId = response.body.data.id
        })
      })
    })

    it('should add products to the card', () => {
      cy.then(() => {
        if (!cardId || !pipelineId) return

        cy.request({
          method: 'PUT',
          url: `${apiUrl}/pipelines/${pipelineId}/cards/${cardId}/products`,
          headers: { Authorization: `Bearer ${authData.token}` },
          body: {
            products: [
              { product_id: productId, quantity: 5, unit_price: 300.00, discount: 0 },
            ],
          },
        }).then((response) => {
          expect(response.status).to.eq(200)
        })
      })
    })

    it('should add observations (comments) to the card', () => {
      cy.then(() => {
        if (!cardId || !pipelineId) return

        cy.request({
          method: 'POST',
          url: `${apiUrl}/pipelines/${pipelineId}/cards/${cardId}/comments`,
          headers: { Authorization: `Bearer ${authData.token}` },
          body: {
            content: 'Cliente demonstrou muito interesse. Agendar demo para próxima semana.',
          },
        }).then((response) => {
          expect(response.status).to.eq(201)
        })

        cy.request({
          method: 'POST',
          url: `${apiUrl}/pipelines/${pipelineId}/cards/${cardId}/comments`,
          headers: { Authorization: `Bearer ${authData.token}` },
          body: {
            content: 'Desconto de 10% aprovado pelo gerente.',
          },
        }).then((response) => {
          expect(response.status).to.eq(201)
        })
      })
    })

    it('should create a task linked to the card', () => {
      cy.then(() => {
        if (!cardId) return

        cy.request({
          method: 'POST',
          url: `${apiUrl}/crm/tasks`,
          headers: { Authorization: `Bearer ${authData.token}` },
          body: {
            title: 'Follow-up da proposta',
            card_id: cardId,
            type: 'follow_up',
            priority: 'high',
            scheduled_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          },
        }).then((response) => {
          expect(response.status).to.eq(201)
        })
      })
    })

    it('should move card between stages', () => {
      cy.then(() => {
        if (!cardId || !pipelineId || !stages?.length || stages.length < 2) return

        cy.request({
          method: 'POST',
          url: `${apiUrl}/pipelines/${pipelineId}/cards/${cardId}/move`,
          headers: { Authorization: `Bearer ${authData.token}` },
          body: { stage_id: stages[1].id },
        }).then((response) => {
          expect(response.status).to.eq(200)
        })
      })
    })

    it('should move card to won stage', () => {
      cy.then(() => {
        if (!cardId || !pipelineId || !stages?.length) return

        const wonStage = stages.find((s: any) => s.is_won)
        if (!wonStage) return

        cy.request({
          method: 'POST',
          url: `${apiUrl}/pipelines/${pipelineId}/cards/${cardId}/move`,
          headers: { Authorization: `Bearer ${authData.token}` },
          body: { stage_id: wonStage.id },
        }).then((response) => {
          expect(response.status).to.eq(200)
        })
      })
    })

    it('should verify card details in UI', () => {
      cy.visit('/crm/pipeline')
      cy.contains('Venda Completa Cypress', { timeout: 15000 }).should('exist')
    })
  })

  describe('Pipeline Settings', () => {
    it('should navigate to pipeline settings', () => {
      cy.visit('/crm/pipeline/settings')
      cy.url().should('include', '/crm/pipeline/settings')
    })

    it('should display stages configuration', () => {
      cy.visit('/crm/pipeline/settings')
      cy.get('input, [class*="stage"]', { timeout: 10000 }).should('have.length.greaterThan', 0)
    })
  })
})
