describe('Dashboard Metrics Read-Only Check', () => {
  it('does not allow clicking/editing metrics', () => {
    cy.visit('/dashboard');
    cy.get('[data-testid="metrics-tile"]').each(($tile) => {
      cy.wrap($tile).click({ force: true });
      cy.get('.toast, .modal').should('not.exist');
    });
  });
});
