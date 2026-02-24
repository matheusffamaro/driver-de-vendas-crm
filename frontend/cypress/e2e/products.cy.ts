describe('Product Management', () => {
  let authData: { token: string; user: any }

  before(() => {
    cy.registerAndLogin('Admin Produtos').then((data) => {
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

  it('should navigate to products page', () => {
    cy.visit('/products')
    cy.url().should('include', '/products')
  })

  it('should create a new product', () => {
    cy.visit('/products')

    cy.contains(/novo|adicionar|criar|new/i).click()

    cy.get('input[name="name"]').type('Produto Cypress')
    cy.get('input[name="price"]').clear().type('199.90')
    cy.get('input[name="sku"]').type('CYP-001')

    cy.get('button[type="submit"]').click()

    cy.contains(/sucesso|criado|salvo/i, { timeout: 10000 }).should('be.visible')
  })

  it('should create a service', () => {
    cy.visit('/products')

    cy.contains(/novo|adicionar|criar|new/i).click()

    cy.get('input[name="name"]').type('Serviço Cypress')
    cy.get('input[name="price"]').clear().type('350.00')

    if (Cypress.$('select[name="type"]').length) {
      cy.get('select[name="type"]').select('service')
    }

    cy.get('button[type="submit"]').click()

    cy.contains(/sucesso|criado|salvo/i, { timeout: 10000 }).should('be.visible')
  })

  it('should edit a product', () => {
    cy.createProductViaApi({ name: 'Editar Produto Cypress', price: 100 })

    cy.visit('/products')
    cy.contains('Editar Produto Cypress').click()

    cy.get('input[name="name"]').clear().type('Produto Editado')
    cy.get('button[type="submit"]').click()

    cy.contains(/sucesso|atualizado|salvo/i, { timeout: 10000 }).should('be.visible')
  })

  it('should delete a product', () => {
    cy.createProductViaApi({ name: 'Deletar Produto Cypress' })

    cy.visit('/products')
    cy.contains('Deletar Produto Cypress').click()

    cy.contains(/excluir|deletar|remover/i).click()
    cy.contains(/confirmar|sim/i).click()

    cy.contains(/sucesso|removido|excluído/i, { timeout: 10000 }).should('be.visible')
  })

  it('should manage product categories', () => {
    cy.visit('/products')

    cy.contains(/categoria|categories/i).click()

    cy.contains(/nova|adicionar|criar/i).click()
    cy.get('input[name="name"]').type('Categoria Cypress')
    cy.get('button[type="submit"]').click()

    cy.contains(/sucesso|criado|salvo/i, { timeout: 10000 }).should('be.visible')
  })
})
