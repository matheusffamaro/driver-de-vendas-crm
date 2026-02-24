/**
 * Settings Plan Tab - Financial Sections Verification
 * Logs in, navigates to settings plan tab, and captures screenshots
 * at each step to verify financial sections render correctly.
 */
describe('Settings Plan Tab - Financial Sections', () => {
  const LOGIN_EMAIL = 'admin@crm.com'
  const LOGIN_PASSWORD = 'admin123'

  before(() => {
    cy.visit('/auth/login')
    cy.screenshot('01-login-page', { capture: 'fullPage' })
    cy.get('input[name="email"]').clear().type(LOGIN_EMAIL)
    cy.get('input[name="password"]').clear().type(LOGIN_PASSWORD)
    cy.get('button[type="submit"]').click()
    cy.url().should('include', '/dashboard', { timeout: 15000 })
    cy.screenshot('02-after-login-dashboard', { capture: 'fullPage' })
  })

  it('should show plan tab with plan name and status badges', () => {
    cy.visit('/settings?tab=plan')
    cy.url().should('include', '/settings')
    cy.url().should('include', 'tab=plan')

    // Wait for plan tab content to load (subscription data, etc.)
    cy.wait(3000)

    cy.screenshot('03-plan-tab-overview', { capture: 'fullPage' })

    // Verify plan name and status badges (Ativo/Trial/Cancelado)
    cy.get('body').then(($body) => {
      const hasPlanName = $body.text().includes('Plano') || $body.text().includes('Business') || $body.text().includes('Starter') || $body.text().includes('Pro')
      const hasStatus = $body.text().includes('Ativo') || $body.text().includes('Trial') || $body.text().includes('Cancelado')
      expect(hasPlanName || hasStatus).to.be.true
    })
  })

  it('should show subscription details row with 4 cards', () => {
    cy.visit('/settings?tab=plan')
    cy.wait(2000)

    // Check for subscription cards: Início, Próx. Cobrança, Pagamento, Status
    cy.contains('Início').should('exist')
    cy.contains('Próx. Cobrança').should('exist')
    cy.contains('Pagamento').should('exist')
    cy.contains('Status').should('exist')

    cy.screenshot('04-subscription-details-cards', { capture: 'fullPage' })
  })

  it('should show Histórico de Pagamentos section when scrolled', () => {
    cy.visit('/settings?tab=plan')
    cy.wait(2000)

    // Scroll to Histórico de Pagamentos
    cy.contains('Histórico de Pagamentos').scrollIntoView()
    cy.wait(500)
    cy.screenshot('05-historico-pagamentos', { capture: 'fullPage' })
  })

  it('should show Cancelar Assinatura section when scrolled', () => {
    cy.visit('/settings?tab=plan')
    cy.wait(2000)

    // Scroll to Cancelar Assinatura
    cy.contains('Cancelar Assinatura').scrollIntoView()
    cy.wait(500)
    cy.screenshot('06-cancelar-assinatura', { capture: 'fullPage' })
  })

  it('full page scroll-through screenshot', () => {
    cy.visit('/settings?tab=plan')
    cy.wait(2000)

    // Full page screenshot to capture everything
    cy.screenshot('07-plan-tab-full-page', { capture: 'fullPage' })
  })
})
