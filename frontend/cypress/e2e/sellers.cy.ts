describe('Seller Management', () => {
  let authData: { token: string; user: any }

  before(() => {
    cy.registerAndLogin('Admin Vendedores').then((data) => {
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

  it('should navigate to users page', () => {
    cy.visit('/users')
    cy.url().should('include', '/users')
    cy.contains(/usuário|vendedor|user/i, { timeout: 10000 }).should('be.visible')
  })

  it('should open invite user modal', () => {
    cy.visit('/users')
    cy.contains(/convidar|invite|novo/i).click()
    cy.get('input[name="email"]').should('be.visible')
  })

  it('should invite a new seller', () => {
    const timestamp = Date.now()
    cy.visit('/users')

    cy.contains(/convidar|invite|novo/i).click()

    cy.get('input[name="email"]').type(`vendedor-${timestamp}@cypress.com`)
    cy.get('select[name="role_id"], [name="role_id"]').should('exist')

    cy.get('button[type="submit"]').click()

    cy.contains(/sucesso|enviado|convite/i, { timeout: 10000 }).should('be.visible')
  })

  it('should display current user in the list', () => {
    cy.visit('/users')
    cy.contains(authData.user.name, { timeout: 10000 }).should('be.visible')
  })
})
