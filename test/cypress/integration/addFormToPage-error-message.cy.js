// The project root directory is the root for the cypress server
describe('addFormToPage Error Message Test', () => {
  it('show an error when a valueset cannot be loaded because of a wrong valueset url', () => {
    // load a lforms form data
    cy.visit('/test/pages/addFormToPageTest.html');
    cy.get("#loadBtn").contains("Load From File");
    cy.get('#fileAnchor').uploadFile('test/data/R4/fhir-context-q-wrong-valueset-url.json');
    cy.get('.lhc-form-title').contains('A questionnaire for testing code that requires a FHIR context 1');
    // has an error message
    cy.get("#loadMsg").contains("Unable to load ValueSet from https://lforms-fhir.nlm.nih.gov/baseDstu3/ValueSet/$expand?url=http://hl7.org/fhir/ValueSet/yesnodontknow-invalid");
  });

  it('show an error when a valueset cannot be loaded because of a wrong fhir context', () => {
    // load a lforms form data
    cy.visit('/test/pages/addFormToPageTest.html');
    cy.get("#loadBtn").contains("Load From File");
    cy.get('#fileAnchor').uploadFile('test/data/R4/fhir-context-q-wrong-fhircontext.json');
    cy.get('.lhc-form-title').contains('A questionnaire for testing code that requires a FHIR context 2');
    // has an error message
    cy.get("#loadMsg").contains("Unable to load ValueSet http://terminology.hl7.org/ValueSet/v3-MessageWaitingPriority-invalid from FHIR server");
  });

  it('show only the first error when there are multiple valuesets cannot be loaded.', () => {
    // load a lforms form data
    cy.visit('/test/pages/addFormToPageTest.html');
    cy.get("#loadBtn").contains("Load From File");
    cy.get('#fileAnchor').uploadFile('test/data/R4/fhir-context-q-wrong-valueset-url-fhircontext.json');
    cy.get('.lhc-form-title').contains('A questionnaire for testing code that requires a FHIR context 3');
    // has one of the error messages (most of the time it's the first error message)
    //"Unable to load ValueSet from https://lforms-fhir.nlm.nih.gov/baseDstu3/ValueSet/$expand?url=http://hl7.org/fhir/ValueSet/yesnodontknow-invalid"
    //"Unable to load ValueSet http://terminology.hl7.org/ValueSet/v3-MessageWaitingPriority-invalid from FHIR server"
    cy.get("#loadMsg").contains("Unable to load ValueSet")
    cy.get("#loadMsg").contains(/v3-MessageWaitingPriority-invalid|yesnodontknow-invalid/g)

  });

  it('successfully load a form that requests AnswerValueSet', (done) => {
    // load a lforms form data
    cy.visit('/test/pages/addFormToPageTest.html');
    cy.get("#loadBtn").contains("Load From File");
    let valueSetQuery;
    cy.intercept({
      query: {
        _format: 'json'
      },
      times: 1
    }, (req) => {
      expect(req.url.endsWith('&_format=json')).to.be.true;
      valueSetQuery = req.url.slice(0, -13);
    }).as('valueSet');
    cy.get('#fileAnchor').uploadFile('test/data/R4/bit-of-everything.json');
    cy.get('.lhc-form-title').contains('Bit of everything');
    // has no error message
    cy.get("#loadMsg").contains("Unable to load ValueSet from").should('not.exist');
    cy.wait('@valueSet').then(() => {
      cy.request(valueSetQuery).then((response) => {
        // Confirm that if the valueSet query is sent without JSON Accept header and _format search param,
        // it returns XML by default from the external server.
        // If in the future the external server changes behavior, we will disable this test case as it is
        // not valid anymore.
        expect(response.body.startsWith('<?xml version=')).to.be.true;
        done();
      });
    });
  });


});
