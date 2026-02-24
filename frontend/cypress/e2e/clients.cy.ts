describe('Client Management', () => {
  let authData: { token: string; user: any }

  before(() => {
    cy.registerAndLogin('Admin Clientes').then((data) => {
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

  it('should navigate to clients page', () => {
    cy.visit('/clients')
    cy.url().should('include', '/clients')
  })

  it('should create a new individual client', () => {
    cy.visit('/clients')

    cy.contains(/novo|adicionar|criar|new/i).click()

    cy.get('input[name="name"]').type('João Cypress PF')
    cy.get('input[name="email"]').type('joao@cypress.com')
    cy.get('input[name="phone"]').type('11999000001')

    cy.get('button[type="submit"]').click()

    cy.contains(/sucesso|criado|salvo/i, { timeout: 10000 }).should('be.visible')
  })

  it('should create a company client', () => {
    cy.visit('/clients')

    cy.contains(/novo|adicionar|criar|new/i).click()

    cy.get('input[name="name"]').type('Empresa Cypress LTDA')
    cy.get('input[name="email"]').type('empresa@cypress.com')

    if (Cypress.$('select[name="type"]').length) {
      cy.get('select[name="type"]').select('company')
    }

    cy.get('button[type="submit"]').click()

    cy.contains(/sucesso|criado|salvo/i, { timeout: 10000 }).should('be.visible')
  })

  it('should search for a client', () => {
    cy.createClientViaApi({ name: 'Buscavel Cypress' })

    cy.visit('/clients')
    cy.get('input[placeholder*="Buscar"], input[placeholder*="buscar"], input[type="search"]')
      .first()
      .type('Buscavel')

    cy.contains('Buscavel Cypress', { timeout: 10000 }).should('be.visible')
  })

  it('should edit a client', () => {
    cy.createClientViaApi({ name: 'Editar Cypress' }).then((client) => {
      cy.visit('/clients')
      cy.contains('Editar Cypress').click()

      cy.get('input[name="name"]').clear().type('Editado Cypress')
      cy.get('button[type="submit"]').click()

      cy.contains(/sucesso|atualizado|salvo/i, { timeout: 10000 }).should('be.visible')
    })
  })

  it('should delete a client', () => {
    cy.createClientViaApi({ name: 'Deletar Cypress' })

    cy.visit('/clients')
    cy.contains('Deletar Cypress').click()

    cy.contains(/excluir|deletar|remover/i).click()
    cy.contains(/confirmar|sim/i).click()

    cy.contains(/sucesso|removido|excluído/i, { timeout: 10000 }).should('be.visible')
  })
})
