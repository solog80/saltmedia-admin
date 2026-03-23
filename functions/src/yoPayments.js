const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const parseXmlString = require('xml2js').parseString; // Ensure xml2js is imported


// Set up Express for handling webhooks
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Helper: Generate XML for deposit request
function generateDepositXml(params, yoConfig) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<AutoCreate>
  <Request>
    <APIUsername>${yoConfig.api_username}</APIUsername>
    <APIPassword>${yoConfig.api_password}</APIPassword>
    <Method>acdepositfunds</Method>
    <NonBlocking>TRUE</NonBlocking>
    <Amount>${params.amount}</Amount>
    <Account>${params.phoneNumber}</Account>
    <Narrative>${params.narrative || 'Mobile deposit'}</Narrative>
    <InstantNotificationUrl>${yoConfig.ipn_url}</InstantNotificationUrl>
    <FailureNotificationUrl>${yoConfig.failure_url}</FailureNotificationUrl>
    <ProviderReferenceText>Your ${params.narrative} has been received. Thanks for your contribution towards GOD's ministry</ProviderReferenceText>
    ${params.externalRef ? `<ExternalReference>${params.externalRef}</ExternalReference>` : ''}
  </Request>
</AutoCreate>`;
}

// 1. Endpoint to initiate deposits
exports.initiateYoDeposit = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { amount, phoneNumber, externalRef, narrative } = req.body;

  try {
    const yoConfig = functions.config().yo; // Access config here

    const xmlRequest = generateDepositXml({
      amount,
      phoneNumber,
      externalRef,
      narrative,
    }, yoConfig);

    const response = await axios.post(yoConfig.api_url, xmlRequest, {
      headers: {
        'Content-Type': 'text/xml',
        'Content-transfer-encoding': 'text',
      },
    });

    // Parse XML response
    const result = await new Promise((resolve, reject) => {
      parseXmlString(response.data, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    const respData = result.AutoCreate.Response[0];
    
    if (respData.Status[0] === 'ERROR') {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).send(JSON.stringify({
        error: respData.StatusMessage[0],
        code: respData.StatusCode[0],
      }));
    }

    // Save transaction to Firestore
    await admin.firestore().collection('transactions').doc(respData.TransactionReference[0]).set({
      amount,
      phoneNumber,
      narrative,
      status: 'pending',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(JSON.stringify({
      transactionRef: respData.TransactionReference[0],
      status: respData.TransactionStatus[0],
    }));

  } catch (error) {
    console.error('Deposit error:', error);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).send(JSON.stringify({ error: 'Deposit failed', details: error.message }));
  }
});

// Helper: Generate XML for transaction status check
function generateTransactionCheckXml(params, yoConfig) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<AutoCreate>
  <Request>
    <APIUsername>${yoConfig.api_username}</APIUsername>
    <APIPassword>${yoConfig.api_password}</APIPassword>
    <Method>actransactioncheckstatus</Method>
    ${params.transactionReference ? `<TransactionReference>${params.transactionReference}</TransactionReference>` : ''}
    ${params.privateTransactionReference ? `<PrivateTransactionReference>${params.privateTransactionReference}</PrivateTransactionReference>` : ''}
    ${params.depositTransactionType ? `<DepositTransactionType>${params.depositTransactionType}</DepositTransactionType>` : ''}
  </Request>
</AutoCreate>`;
}

// 4. Endpoint to check transaction status
exports.checkYoTransactionStatus = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { transactionReference, privateTransactionReference, depositTransactionType } = req.body;

  if (!transactionReference && !privateTransactionReference) {
    return res.status(400).send('Either transactionReference or privateTransactionReference is required.');
  }

  try {
    const yoConfig = functions.config().yo;

    const xmlRequest = generateTransactionCheckXml({
      transactionReference,
      privateTransactionReference,
      depositTransactionType,
    }, yoConfig);

    const response = await axios.post(yoConfig.api_url, xmlRequest, {
      headers: {
        'Content-Type': 'text/xml',
        'Content-transfer-encoding': 'text',
      },
    });
    console.log('Yo! Payments Raw Response:', response.data); // Added log

    const result = await new Promise((resolve, reject) => {
      parseXmlString(response.data, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    console.log('Parsed XML Result:', result); // Added log

    const respData = result?.AutoCreate?.Response?.[0];

    if (!respData) {
      console.error('Failed to parse expected response structure from Yo! Payments XML. Result:', JSON.stringify(result));
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).send(JSON.stringify({ error: 'Failed to parse Yo! Payments response', details: 'Expected AutoCreate.Response[0] but it was not found.' }));
    }

    if (respData.Status?.[0] === 'ERROR') {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).send(JSON.stringify({
        error: respData.StatusMessage?.[0],
        code: respData.StatusCode?.[0],
      }));
    }

    // Update Firestore with the latest transaction status
    const updateData = {
      status: respData.Status?.[0] || null, // Keep API call status
      transactionStatus: respData.TransactionStatus?.[0] || null, // Add transaction status
      statusMessage: respData.StatusMessage?.[0] || null,
      transactionCompletionDate: respData.TransactionCompletionDate ? respData.TransactionCompletionDate[0] : null,
      issuedReceiptNumber: respData.IssuedReceiptNumber ? respData.IssuedReceiptNumber[0] : null,
    };

    // Add completedAt or failedAt timestamp based on status
    if (respData.TransactionStatus?.[0] === 'SUCCEEDED') {
      updateData.completedAt = admin.firestore.FieldValue.serverTimestamp();
    } else if (respData.TransactionStatus?.[0] === 'FAILED') {
      updateData.failedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    let docToUpdateRef;
    if (transactionReference) {
      docToUpdateRef = admin.firestore().collection('transactions').doc(transactionReference);
    } else if (privateTransactionReference) {
      // If only privateTransactionReference is provided, query for the document
      // Assuming 'externalRef' is the field where privateTransactionReference is stored
      const querySnapshot = await admin.firestore().collection('transactions')
        .where('externalRef', '==', privateTransactionReference)
        .orderBy('timestamp', 'desc') // Assuming 'timestamp' exists for ordering
        .limit(1)
        .get();

      if (!querySnapshot.empty) {
        docToUpdateRef = querySnapshot.docs[0].ref;
      } else {
        console.warn(`No transaction found for privateTransactionReference: ${privateTransactionReference}`);
      }
    }

    if (docToUpdateRef) {
      await docToUpdateRef.update(updateData);
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(JSON.stringify({
      status: respData.Status?.[0],
      transactionStatus: respData.TransactionStatus?.[0],
      statusMessage: respData.StatusMessage?.[0],
      transactionReference: respData.TransactionReference?.[0],
      privateTransactionReference: respData.PrivateTransactionReference?.[0],
      amount: respData.Amount?.[0],
      amountFormatted: respData.AmountFormatted?.[0],
      currencyCode: respData.CurrencyCode?.[0],
      transactionInitiationDate: respData.TransactionInitiationDate?.[0],
      transactionCompletionDate: respData.TransactionCompletionDate?.[0],
      issuedReceiptNumber: respData.IssuedReceiptNumber?.[0],
    }));

  } catch (error) {
    console.error('Transaction status check error:', error);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).send(JSON.stringify({ error: 'Transaction status check failed', details: error.message }));
  }
});


// 2. IPN Handler (Success notifications)
app.post('/yo-ipn', async (req, res) => {
  try {
    const { amount, msisdn, network_ref, external_ref } = req.body;
    
    // Update Firestore
    await admin.firestore().collection('transactions').doc(external_ref).update({
      status: 'success',
      networkRef: network_ref,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Optional: Trigger SMS to user by returning a narrative
    res.status(200).send('narrative=Payment+received+successfully');
    
  } catch (error) {
    console.error('IPN Error:', error);
    res.status(500).send('Error processing IPN');
  }
});



// 3. Failure Notification Handler
app.post('/yo-failure', async (req, res) => {
  try {
    const { failed_transaction_reference } = req.body;
    
    await admin.firestore().collection('transactions')
      .doc(failed_transaction_reference)
      .update({
        status: 'failed',
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    res.status(200).send('OK');
    
  } catch (error) {
    console.error('Failure Notification Error:', error);
    res.status(500).send('Error processing failure');
  }
});


// Expose webhooks
exports.yoWebhooks = functions.https.onRequest(app);