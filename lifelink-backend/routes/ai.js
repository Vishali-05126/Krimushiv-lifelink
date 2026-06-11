const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const isDbReady = () => mongoose.connection.readyState === 1;

// Blood type compatibility for AI triage
const COMPATIBILITY = {
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A+', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+'],
};

// Rule-based AI triage engine (always available, no external API needed)
function runRuleTriage(input) {
  const { bloodType, unitsNeeded = 1, symptoms = [], patientAge, urgency, availableStock = {} } = input;

  const bt = (bloodType || '').toUpperCase();
  const compatible = COMPATIBILITY[bt] || [];
  const stock = Object.entries(availableStock)
    .filter(([type]) => compatible.includes(type))
    .map(([type, units]) => ({ type, units }));

  const totalCompatible = stock.reduce((s, e) => s + e.units, 0);
  const directStock = availableStock[bt] || 0;

  // Severity scoring
  let severityScore = 0;
  const criticalSymptoms = ['unresponsive', 'cardiac arrest', 'hemorrhage', 'shock', 'trauma'];
  const urgentSymptoms = ['unconscious', 'heavy bleeding', 'low bp', 'pale', 'rapid pulse'];

  symptoms.forEach((s) => {
    const sl = s.toLowerCase();
    if (criticalSymptoms.some((c) => sl.includes(c))) severityScore += 3;
    else if (urgentSymptoms.some((u) => sl.includes(u))) severityScore += 2;
    else severityScore += 1;
  });

  if (urgency === 'critical') severityScore += 4;
  else if (urgency === 'urgent') severityScore += 2;
  if (unitsNeeded >= 4) severityScore += 2;
  if (patientAge && (patientAge < 5 || patientAge > 75)) severityScore += 1;
  if (bt === 'O-' || bt === 'AB-') severityScore += 1; // rare types

  let triageLevel, action, recommendation;

  if (severityScore >= 7) {
    triageLevel = 'CRITICAL';
    action = 'Immediate transfusion required. Activate all nearby donors now.';
  } else if (severityScore >= 4) {
    triageLevel = 'URGENT';
    action = 'Urgent transfusion within 2 hours. Notify top-ranked donors.';
  } else {
    triageLevel = 'ROUTINE';
    action = 'Schedule donation within 24 hours.';
  }

  if (directStock >= unitsNeeded) {
    recommendation = `${bt} stock available (${directStock} units). Proceed with direct transfusion.`;
  } else if (totalCompatible >= unitsNeeded) {
    const alt = stock.find((s) => s.units >= unitsNeeded);
    recommendation = alt
      ? `Insufficient direct ${bt} stock. Use compatible ${alt.type} (${alt.units} units available).`
      : `Combine compatible types: ${stock.map((s) => `${s.type}(${s.units})`).join(', ')} to meet ${unitsNeeded} unit need.`;
  } else {
    recommendation = `Stock critically low. Broadcast emergency donor alert for ${bt} and compatible types immediately.`;
  }

  const donorSearchTypes = [...new Set([bt, ...compatible.filter((t) => t !== bt)])];

  return {
    triageLevel,
    severityScore,
    action,
    recommendation,
    bloodTypeAnalysis: {
      requested: bt,
      compatibleTypes: compatible,
      directStock,
      totalCompatibleStock: totalCompatible,
      stockBreakdown: stock,
    },
    donorSearch: {
      priorityTypes: donorSearchTypes,
      expandSearch: totalCompatible < unitsNeeded,
      suggestedRadius: severityScore >= 7 ? 50 : severityScore >= 4 ? 25 : 10,
    },
    estimatedTimeToFulfill:
      triageLevel === 'CRITICAL' ? '< 30 minutes' :
      triageLevel === 'URGENT'   ? '1-2 hours' : '6-24 hours',
  };
}

// Try AWS Bedrock (Claude) for enhanced AI response, fall back to rule engine
async function runBedrockTriage(input, ruleResult) {
  try {
    const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

    const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

    const prompt = `You are a medical AI triage assistant for LifeLink Emergency Blood Network.

Patient details:
- Blood type needed: ${input.bloodType}
- Units needed: ${input.unitsNeeded || 1}
- Patient age: ${input.patientAge || 'unknown'}
- Urgency: ${input.urgency || 'unknown'}
- Symptoms: ${(input.symptoms || []).join(', ') || 'none provided'}
- Available blood stock: ${JSON.stringify(input.availableStock || {})}

Rule-based triage result: ${ruleResult.triageLevel} — ${ruleResult.action}

Provide a brief clinical recommendation (2-3 sentences) focused on: transfusion priority, any medical precautions, and donor outreach strategy. Be concise and clinical.`;

    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body,
    });

    const response = await client.send(command);
    const parsed = JSON.parse(Buffer.from(response.body).toString());
    return parsed.content?.[0]?.text || null;
  } catch (_err) {
    return null; // Bedrock not configured — use rule engine only
  }
}

// POST /api/ai/triage
// Input: { bloodType, unitsNeeded, symptoms[], patientAge, urgency, availableStock{} }
router.post('/triage', async (req, res) => {
  try {
    if (!isDbReady()) {
      const input = req.body || {};
      if (!input.bloodType) return res.status(400).json({ message: 'bloodType is required' });

      const ruleResult = runRuleTriage(input);
      res.json({
        ...ruleResult,
        aiInsight: null,
        aiPowered: false,
        timestamp: new Date(),
      });
    } else {
      const input = req.body || {};
      if (!input.bloodType) return res.status(400).json({ message: 'bloodType is required' });

      const ruleResult = runRuleTriage(input);
      const aiInsight = await runBedrockTriage(input, ruleResult);

      res.json({
        ...ruleResult,
        aiInsight: aiInsight || null,
        aiPowered: !!aiInsight,
        timestamp: new Date(),
      });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/ai/donor-match-explain
// Explains why a donor was ranked first
router.post('/donor-match-explain', async (req, res) => {
  try {
    const { donor, request } = req.body || {};
    if (!donor || !request) return res.status(400).json({ message: 'donor and request are required' });

    const DonorEligibility = require('../utils/donorEligibility');
    const eligibility = DonorEligibility.evaluate(donor, request.isEmergency || false);
    const score = DonorEligibility.calculateScore(donor, request);

    const reasons = [];
    if (DonorEligibility.isCompatible(donor.bloodType, request.bloodType)) {
      reasons.push(`Blood type ${donor.bloodType} is compatible with ${request.bloodType}`);
    }
    if (donor.distance != null) reasons.push(`Located ${donor.distance.toFixed(1)} km away`);
    if (donor.donations) reasons.push(`${donor.donations} prior donations (experienced donor)`);
    if (donor.hemoglobin) reasons.push(`Hemoglobin: ${donor.hemoglobin} g/dL`);

    res.json({
      donorId: donor._id,
      matchScore: score.toFixed(3),
      eligibility,
      reasons,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/ai/shortage-forecast
// Forecasts shortage risk based on current stock levels
router.get('/shortage-forecast', async (req, res) => {
  try {
    let stockMap = {};

    if (isDbReady()) {
      const Hospital = require('../models/Hospital');
      const hospitals = await Hospital.find({ hasBloodBank: true }).select('bloodStock').lean();
      hospitals.forEach((h) => {
        if (h.bloodStock) {
          Object.entries(h.bloodStock).forEach(([type, units]) => {
            stockMap[type] = (stockMap[type] || 0) + Number(units || 0);
          });
        }
      });
    }

    const allTypes = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
    const rareTypes = ['O-', 'AB-', 'B-', 'A-'];
    const minSafe = { 'O-': 10, 'O+': 20, 'A-': 8, 'A+': 20, 'B-': 8, 'B+': 15, 'AB-': 5, 'AB+': 15 };

    const forecast = allTypes.map((type) => {
      const current = stockMap[type] || 0;
      const min = minSafe[type];
      const risk = current === 0 ? 'CRITICAL' : current < min * 0.5 ? 'HIGH' : current < min ? 'MEDIUM' : 'LOW';
      return { bloodType: type, currentUnits: current, minSafe: min, risk, rare: rareTypes.includes(type) };
    });

    const critical = forecast.filter((f) => f.risk === 'CRITICAL' || f.risk === 'HIGH');

    res.json({
      forecast,
      criticalTypes: critical.map((f) => f.bloodType),
      actionRequired: critical.length > 0,
      summary: critical.length > 0
        ? `${critical.length} blood type(s) at critical/high shortage risk: ${critical.map((f) => f.bloodType).join(', ')}`
        : 'All blood types at safe levels',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
