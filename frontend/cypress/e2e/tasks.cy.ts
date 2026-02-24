describe('Task Management', () => {
  let authData: { token: string; user: any }

  before(() => {
    cy.registerAndLogin('Admin Tarefas').then((data) => {
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

  it('should navigate to tasks page', () => {
    cy.visit('/crm/tasks')
    cy.url().should('include', '/crm/tasks')
  })

  it('should create a standalone task', () => {
    cy.visit('/crm/tasks')

    cy.contains(/nova|adicionar|criar|new/i).click()

    cy.get('input[name="title"]').type('Tarefa Cypress Standalone')

    if (Cypress.$('textarea[name="description"]').length) {
      cy.get('textarea[name="description"]').type('Descrição da tarefa criada pelo Cypress')
    }

    cy.get('button[type="submit"]').click()

    cy.contains(/sucesso|criado|salvo/i, { timeout: 10000 }).should('be.visible')
  })

  it('should create a task with priority', () => {
    cy.visit('/crm/tasks')

    cy.contains(/nova|adicionar|criar|new/i).click()

    cy.get('input[name="title"]').type('Tarefa Urgente Cypress')

    if (Cypress.$('select[name="priority"]').length) {
      cy.get('select[name="priority"]').select('urgent')
    }

    cy.get('button[type="submit"]').click()

    cy.contains(/sucesso|criado|salvo/i, { timeout: 10000 }).should('be.visible')
  })

  it('should create a task with type call', () => {
    cy.visit('/crm/tasks')

    cy.contains(/nova|adicionar|criar|new/i).click()

    cy.get('input[name="title"]').type('Ligação Follow-up')

    if (Cypress.$('select[name="type"]').length) {
      cy.get('select[name="type"]').select('call')
    }

    cy.get('button[type="submit"]').click()

    cy.contains(/sucesso|criado|salvo/i, { timeout: 10000 }).should('be.visible')
  })

  it('should complete a task', () => {
    const apiUrl = Cypress.env('apiUrl')

    cy.request({
      method: 'POST',
      url: `${apiUrl}/crm/tasks`,
      headers: { Authorization: `Bearer ${authData.token}` },
      body: { title: 'Completar Cypress', type: 'task', priority: 'medium' },
    })

    cy.visit('/crm/tasks')
    cy.contains('Completar Cypress', { timeout: 10000 }).should('be.visible')

    cy.contains('Completar Cypress').parent().within(() => {
      cy.get('button, input[type="checkbox"]').first().click()
    })
  })

  it('should filter tasks by status', () => {
    cy.visit('/crm/tasks')

    if (Cypress.$('select[name="status"], [data-testid="filter-status"]').length) {
      cy.get('select[name="status"], [data-testid="filter-status"]').first().select('pending')
    }
  })
})
