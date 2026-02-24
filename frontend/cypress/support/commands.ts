declare global {
  namespace Cypress {
    interface Chainable {
      login(email?: string, password?: string): Chainable<void>
      registerAndLogin(name?: string): Chainable<{ token: string; user: any; tenant: any }>
      apiLogin(email: string, password: string): Chainable<{ token: string; user: any }>
      createClientViaApi(data?: Partial<ClientData>): Chainable<any>
      createProductViaApi(data?: Partial<ProductData>): Chainable<any>
    }
  }
}

interface ClientData {
  name: string
  email: string
  phone: string
  type: string
}

interface ProductData {
  name: string
  price: number
  type: string
}

const API_URL = Cypress.env('apiUrl') || 'http://localhost:8000/api'

let authToken: string | null = null

Cypress.Commands.add('login', (email = 'test@test.com', password = 'senha123') => {
  cy.visit('/auth/login')
  cy.get('input[name="email"]').clear().type(email)
  cy.get('input[name="password"]').clear().type(password)
  cy.get('button[type="submit"]').click()
  cy.url().should('include', '/dashboard', { timeout: 15000 })
})

Cypress.Commands.add('registerAndLogin', (name = 'Test User') => {
  const email = `test-${Date.now()}@cypress.com`
  const password = 'senha123'
  const tenantName = `Empresa ${Date.now()}`

  return cy.request({
    method: 'POST',
    url: `${API_URL}/auth/register`,
    body: {
      name,
      email,
      password,
      password_confirmation: password,
      tenant_name: tenantName,
    },
  }).then((response) => {
    const { access_token, user } = response.body.data
    authToken = access_token

    window.localStorage.setItem('auth-storage', JSON.stringify({
      state: {
        user,
        token: access_token,
        isAuthenticated: true,
      },
    }))

    return { token: access_token, user, tenant: { name: tenantName } }
  })
})

Cypress.Commands.add('apiLogin', (email: string, password: string) => {
  return cy.request({
    method: 'POST',
    url: `${API_URL}/auth/login`,
    body: { email, password },
  }).then((response) => {
    const { access_token, user } = response.body.data
    authToken = access_token
    return { token: access_token, user }
  })
})

Cypress.Commands.add('createClientViaApi', (data = {}) => {
  const clientData = {
    name: data.name || `Cliente Cypress ${Date.now()}`,
    email: data.email || `client-${Date.now()}@cypress.com`,
    phone: data.phone || '11999000001',
    type: data.type || 'individual',
  }

  return cy.request({
    method: 'POST',
    url: `${API_URL}/clients`,
    headers: { Authorization: `Bearer ${authToken}` },
    body: clientData,
  }).then((response) => response.body.data)
})

Cypress.Commands.add('createProductViaApi', (data = {}) => {
  const productData = {
    name: data.name || `Produto Cypress ${Date.now()}`,
    price: data.price || 99.90,
    type: data.type || 'product',
  }

  return cy.request({
    method: 'POST',
    url: `${API_URL}/products`,
    headers: { Authorization: `Bearer ${authToken}` },
    body: productData,
  }).then((response) => response.body.data)
})

export {}
