describe('Authentication', () => {
  beforeEach(() => {
    cy.visit('/auth/login')
  })

  describe('Registration', () => {
    it('should register a new account successfully', () => {
      cy.visit('/auth/register')

      const timestamp = Date.now()
      cy.get('input[name="name"]').type('Usuário Teste')
      cy.get('input[name="email"]').type(`test-${timestamp}@cypress.com`)
      cy.get('input[name="password"]').type('senha12345')
      cy.get('input[name="password_confirmation"]').type('senha12345')
      cy.get('input[name="tenant_name"]').type('Empresa Cypress')

      cy.get('button[type="submit"]').click()

      cy.url().should('include', '/dashboard', { timeout: 15000 })
    })

    it('should show validation errors for empty fields', () => {
      cy.visit('/auth/register')

      cy.get('button[type="submit"]').click()

      cy.contains(/nome|name/i).should('be.visible')
      cy.contains(/e-mail|email/i).should('be.visible')
    })

    it('should show error for mismatched passwords', () => {
      cy.visit('/auth/register')

      cy.get('input[name="name"]').type('User')
      cy.get('input[name="email"]').type('mismatch@test.com')
      cy.get('input[name="password"]').type('senha12345')
      cy.get('input[name="password_confirmation"]').type('outrasenha')
      cy.get('input[name="tenant_name"]').type('Empresa')

      cy.get('button[type="submit"]').click()

      cy.contains(/senhas|password/i).should('be.visible')
    })
  })

  describe('Login', () => {
    it('should login with valid credentials', () => {
      cy.registerAndLogin('Login Test User').then(({ user }) => {
        cy.visit('/auth/login')
        cy.get('input[name="email"]').type(user.email)
        cy.get('input[name="password"]').type('senha123')
        cy.get('button[type="submit"]').click()

        cy.url().should('include', '/dashboard', { timeout: 15000 })
      })
    })

    it('should show error for invalid credentials', () => {
      cy.get('input[name="email"]').type('naoexiste@test.com')
      cy.get('input[name="password"]').type('senhaerrada')
      cy.get('button[type="submit"]').click()

      cy.contains(/erro|invalid|incorret/i, { timeout: 10000 }).should('be.visible')
    })

    it('should navigate to register page', () => {
      cy.contains(/criar conta|cadastr|registr/i).click()
      cy.url().should('include', '/auth/register')
    })
  })

  describe('Redirect', () => {
    it('should redirect unauthenticated user to login', () => {
      cy.visit('/dashboard')
      cy.url().should('include', '/auth/login', { timeout: 10000 })
    })
  })
})
