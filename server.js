const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Load knowledge bases
let regulations = {};
let riskFramework = {};

try {
  regulations = JSON.parse(fs.readFileSync(path.join(__dirname, '../knowledge-base/regulations.json'), 'utf8'));
  riskFramework = JSON.parse(fs.readFileSync(path.join(__dirname, '../knowledge-base/risk-framework.json'), 'utf8'));
  console.log('✓ Knowledge bases loaded successfully');
} catch (error) {
  console.error('Error loading knowledge bases:', error);
  process.exit(1);
}

// Knowledge-Based Decision Engine
class AIRiskAnalysisEngine {
  constructor(regulations, riskFramework) {
    this.regulations = regulations;
    this.riskFramework = riskFramework;
  }

  analyzeRisk(input) {
    const {
      useCaseCategory,
      jurisdictions,
      dataTypes,
      decisionImpact,
      hasHumanOversight,
      isTransparent,
      industry
    } = input;

    // Calculate risk scores based on framework
    const useCaseScore = this.calculateUseCaseScore(useCaseCategory);
    const jurisdictionScore = this.calculateJurisdictionScore(jurisdictions);
    const dataScore = this.calculateDataScore(dataTypes);
    const impactScore = this.calculateImpactScore(decisionImpact);
    const transparencyScore = this.calculateTransparencyScore(hasHumanOversight, isTransparent);

    // Weighted total score
    const weights = this.riskFramework.risk_assessment_framework.scoring_factors;
    const totalScore = 
      (useCaseScore * (weights.use_case_risk.weight / 100)) +
      (jurisdictionScore * (weights.jurisdiction_risk.weight / 100)) +
      (dataScore * (weights.data_sensitivity.weight / 100)) +
      (impactScore * (weights.decision_impact.weight / 100)) +
      (transparencyScore * (weights.transparency_level.weight / 100));

    // Determine risk level
    const riskLevel = this.getRiskLevel(totalScore);

    // Get applicable regulations
    const applicableRegulations = this.getApplicableRegulations(jurisdictions, useCaseCategory, dataTypes, industry);

    // Get compliance requirements
    const complianceRequirements = this.getComplianceRequirements(jurisdictions, useCaseCategory, dataTypes, industry);

    // Generate recommendations
    const recommendations = this.generateRecommendations(riskLevel, applicableRegulations, complianceRequirements, input);

    return {
      riskScore: Math.round(totalScore),
      riskLevel: riskLevel.level,
      riskDescription: riskLevel.description,
      breakdown: {
        useCaseScore,
        jurisdictionScore,
        dataScore,
        impactScore,
        transparencyScore
      },
      applicableRegulations,
      complianceRequirements,
      recommendations,
      nextSteps: riskLevel.actions,
      estimatedComplianceTimeline: this.estimateTimeline(complianceRequirements),
      regulatoryReferences: this.getDetailedReferences(applicableRegulations)
    };
  }

  calculateUseCaseScore(useCaseCategory) {
    const categories = this.riskFramework.risk_assessment_framework.scoring_factors.use_case_risk.categories;
    
    const mapping = {
      'credit-scoring': categories.high_risk.score,
      'employment-decisions': categories.high_risk.score,
      'education-assessment': categories.high_risk.score,
      'law-enforcement': categories.high_risk.score,
      'critical-infrastructure': categories.high_risk.score,
      'healthcare-diagnosis': categories.significant_risk.score,
      'insurance-underwriting': categories.significant_risk.score,
      'content-moderation': categories.significant_risk.score,
      'customer-service': categories.moderate_risk.score,
      'marketing': categories.moderate_risk.score,
      'recommendation-system': categories.moderate_risk.score,
      'business-automation': categories.moderate_risk.score,
      'spam-filter': categories.low_risk.score,
      'gaming': categories.low_risk.score,
      'research-tool': categories.low_risk.score
    };

    return mapping[useCaseCategory] || categories.moderate_risk.score;
  }

  calculateJurisdictionScore(jurisdictions) {
    const scoring = this.riskFramework.risk_assessment_framework.scoring_factors.jurisdiction_risk.scoring;
    let maxScore = 0;

    jurisdictions.forEach(jurisdiction => {
      const key = jurisdiction.toLowerCase().replace(' ', '_') + '_operations';
      if (scoring[key]) {
        maxScore = Math.max(maxScore, scoring[key].score);
      }
    });

    return maxScore || 10;
  }

  calculateDataScore(dataTypes) {
    const categories = this.riskFramework.risk_assessment_framework.scoring_factors.data_sensitivity.categories;
    let maxScore = 0;

    dataTypes.forEach(dataType => {
      const key = dataType.toLowerCase().replace(/ /g, '_').replace(/-/g, '_');
      if (categories[key]) {
        maxScore = Math.max(maxScore, categories[key].score);
      }
    });

    return maxScore || 20;
  }

  calculateImpactScore(decisionImpact) {
    const categories = this.riskFramework.risk_assessment_framework.scoring_factors.decision_impact.categories;
    
    const mapping = {
      'life-safety': categories.life_safety.score,
      'legal-rights': categories.legal_rights.score,
      'significant-economic': categories.significant_economic.score,
      'moderate-economic': categories.moderate_economic.score,
      'limited-impact': categories.limited_impact.score,
      'no-impact': categories.no_individual_impact.score
    };

    return mapping[decisionImpact] || categories.limited_impact.score;
  }

  calculateTransparencyScore(hasHumanOversight, isTransparent) {
    const scoring = this.riskFramework.risk_assessment_framework.scoring_factors.transparency_level.scoring;
    
    if (hasHumanOversight && isTransparent) {
      return scoring.full_transparency.score;
    } else if (isTransparent) {
      return scoring.substantial_transparency.score;
    } else if (hasHumanOversight) {
      return scoring.basic_transparency.score;
    } else {
      return scoring.opaque.score;
    }
  }

  getRiskLevel(score) {
    const levels = this.riskFramework.risk_assessment_framework.risk_levels;
    
    if (score >= 90) return { level: 'Critical', ...levels.critical };
    if (score >= 70) return { level: 'High', ...levels.high };
    if (score >= 40) return { level: 'Medium', ...levels.medium };
    return { level: 'Low', ...levels.low };
  }

  getApplicableRegulations(jurisdictions, useCaseCategory, dataTypes, industry) {
    const applicable = [];

    jurisdictions.forEach(jurisdiction => {
      const jurisdictionKey = jurisdiction.toUpperCase().replace(' ', '_');
      const regionData = this.regulations.regions[jurisdictionKey];

      if (regionData && regionData.regulations) {
        regionData.regulations.forEach(reg => {
          applicable.push({
            jurisdiction: regionData.name,
            regulationId: reg.id,
            regulationName: reg.name,
            status: reg.status,
            effectiveDate: reg.effective_date,
            summary: reg.summary,
            keyProvisions: this.extractRelevantProvisions(reg, useCaseCategory, dataTypes, industry),
            penalties: this.extractPenalties(reg),
            complianceDeadline: reg.full_compliance_date || reg.effective_date
          });
        });
      }
    });

    return applicable;
  }

  extractRelevantProvisions(regulation, useCaseCategory, dataTypes, industry) {
    const provisions = [];

    // Extract risk category provisions for EU AI Act
    if (regulation.id === 'EU-AI-ACT-2024' && regulation.risk_categories) {
      const isHighRisk = ['credit-scoring', 'employment-decisions', 'education-assessment', 
                          'law-enforcement', 'critical-infrastructure'].includes(useCaseCategory);
      
      if (isHighRisk && regulation.risk_categories.high) {
        provisions.push({
          category: 'High-Risk AI Requirements',
          requirements: regulation.risk_categories.high.requirements,
          penalties: regulation.risk_categories.high.penalties
        });
      }

      if (regulation.risk_categories.limited) {
        provisions.push({
          category: 'Transparency Obligations',
          requirements: regulation.risk_categories.limited.requirements,
          penalties: regulation.risk_categories.limited.penalties
        });
      }
    }

    // Extract GDPR provisions
    if (regulation.id === 'GDPR-AI' && regulation.key_provisions) {
      provisions.push({
        category: 'GDPR Data Protection Requirements',
        requirements: regulation.key_provisions
      });
    }

    // Extract automated decision-making provisions
    if (regulation.ai_specific_requirements) {
      provisions.push({
        category: 'AI-Specific Requirements',
        requirements: regulation.ai_specific_requirements
      });
    }

    return provisions;
  }

  extractPenalties(regulation) {
    if (regulation.penalties) {
      return regulation.penalties;
    }

    if (regulation.risk_categories) {
      const penalties = [];
      Object.values(regulation.risk_categories).forEach(category => {
        if (category.penalties) {
          penalties.push(category.penalties);
        }
      });
      return penalties.join('; ');
    }

    return 'Penalties vary based on violation severity';
  }

  getComplianceRequirements(jurisdictions, useCaseCategory, dataTypes, industry) {
    const requirements = [];
    const matrix = this.riskFramework.compliance_requirements_matrix;

    // Check EU high-risk requirements
    if (jurisdictions.includes('EU') && ['credit-scoring', 'employment-decisions', 
        'education-assessment', 'law-enforcement', 'critical-infrastructure'].includes(useCaseCategory)) {
      requirements.push({
        category: 'EU High-Risk AI Compliance',
        mandatory: true,
        requirements: matrix.high_risk_ai_eu.mandatory_requirements
      });
    }

    // Check GDPR automated decision-making
    if (jurisdictions.includes('EU') && ['credit-scoring', 'employment-decisions', 
        'insurance-underwriting', 'education-assessment'].includes(useCaseCategory)) {
      requirements.push({
        category: 'GDPR Automated Decision-Making',
        mandatory: true,
        requirements: matrix.automated_decision_making_gdpr.mandatory_requirements
      });
    }

    // Check US financial services
    if ((jurisdictions.includes('USA') || jurisdictions.includes('California')) && 
        industry === 'financial-services') {
      requirements.push({
        category: 'US Financial Services AI Compliance',
        mandatory: true,
        requirements: matrix.financial_ai_us.mandatory_requirements
      });
    }

    // Check healthcare
    if (industry === 'healthcare') {
      requirements.push({
        category: 'Healthcare AI Compliance',
        mandatory: true,
        requirements: matrix.healthcare_ai_global.mandatory_requirements
      });
    }

    // Check China generative AI
    if (jurisdictions.includes('China') && useCaseCategory === 'customer-service') {
      requirements.push({
        category: 'China Generative AI Compliance',
        mandatory: true,
        requirements: matrix.china_generative_ai.mandatory_requirements
      });
    }

    return requirements;
  }

  generateRecommendations(riskLevel, applicableRegulations, complianceRequirements, input) {
    const recommendations = [];

    // Priority recommendations based on risk level
    if (riskLevel.level === 'Critical' || riskLevel.level === 'High') {
      recommendations.push({
        priority: 'IMMEDIATE',
        category: 'Legal Review',
        action: 'Engage qualified legal counsel specializing in AI regulation',
        rationale: 'High-risk systems require expert legal guidance to ensure compliance',
        timeline: 'Within 1 week'
      });

      recommendations.push({
        priority: 'IMMEDIATE',
        category: 'Risk Assessment',
        action: 'Conduct comprehensive Data Protection Impact Assessment (DPIA)',
        rationale: 'Required for high-risk AI systems under GDPR and similar regulations',
        timeline: 'Within 2 weeks',
        specificRequirements: [
          'Identify and assess risks to data subjects',
          'Document necessity and proportionality',
          'Identify mitigation measures',
          'Consult Data Protection Officer if applicable'
        ]
      });
    }

    // Data governance recommendations
    const hasSpecialCategory = input.dataTypes.some(dt => 
      dt.includes('biometric') || dt.includes('health') || dt.includes('genetic')
    );

    if (hasSpecialCategory) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Data Governance',
        action: 'Implement enhanced data protection measures for special category data',
        rationale: 'Special category data requires heightened protection under GDPR Article 9',
        specificMeasures: [
          'Obtain explicit consent or establish alternative legal basis',
          'Implement encryption at rest and in transit',
          'Conduct regular data quality audits',
          'Establish strict access controls with audit logging',
          'Document data minimization efforts'
        ]
      });
    }

    // Transparency recommendations
    if (!input.isTransparent) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Transparency',
        action: 'Develop comprehensive AI disclosure and explanation framework',
        rationale: 'Transparency is a core requirement across all major AI regulations',
        specificActions: [
          'Create plain-language explanations of AI decision-making',
          'Implement user-facing AI interaction notices',
          'Document system limitations and potential biases',
          'Establish process for providing meaningful explanations on request'
        ]
      });
    }

    // Human oversight recommendations
    if (!input.hasHumanOversight && riskLevel.level !== 'Low') {
      recommendations.push({
        priority: 'HIGH',
        category: 'Human Oversight',
        action: 'Establish human oversight mechanisms',
        rationale: 'Required for high and medium-risk AI systems',
        specificMeasures: [
          'Design human-in-the-loop review processes',
          'Train oversight personnel on AI system capabilities and limitations',
          'Implement override capabilities',
          'Document all human review decisions',
          'Establish escalation procedures'
        ]
      });
    }

    // Technical documentation recommendations
    recommendations.push({
      priority: riskLevel.level === 'Critical' || riskLevel.level === 'High' ? 'IMMEDIATE' : 'MEDIUM',
      category: 'Technical Documentation',
      action: 'Create and maintain comprehensive technical documentation',
      rationale: 'Required by EU AI Act, proposed regulations globally',
      requiredDocuments: [
        'System architecture and design specifications',
        'Training data sources, characteristics, and quality metrics',
        'Model development methodology and validation results',
        'Performance metrics and accuracy benchmarks',
        'Known limitations and failure modes',
        'Maintenance and update procedures',
        'Security and cybersecurity measures'
      ]
    });

    // Monitoring and audit recommendations
    recommendations.push({
      priority: 'MEDIUM',
      category: 'Ongoing Monitoring',
      action: 'Implement post-deployment monitoring and audit systems',
      rationale: 'Regulatory requirements for ongoing oversight of AI systems',
      specificSystems: [
        'Automated logging of AI decisions and inputs',
        'Performance monitoring and drift detection',
        'Bias and fairness testing on production data',
        'User feedback and complaint mechanisms',
        'Regular compliance audits',
        'Incident detection and response procedures'
      ]
    });

    // Jurisdiction-specific recommendations
    if (applicableRegulations.some(reg => reg.jurisdiction.includes('European Union'))) {
      recommendations.push({
        priority: 'HIGH',
        category: 'EU AI Act Compliance',
        action: 'Prepare for EU AI Act conformity assessment',
        rationale: 'Mandatory for high-risk AI systems in EU market',
        preparationSteps: [
          'Determine if third-party conformity assessment required',
          'Prepare technical documentation package',
          'Establish quality management system',
          'Plan for EU database registration',
          'Identify notified body if external assessment needed'
        ]
      });
    }

    if (applicableRegulations.some(reg => reg.jurisdiction.includes('China'))) {
      recommendations.push({
        priority: 'HIGH',
        category: 'China Compliance',
        action: 'Complete CAC algorithm filing and security assessment',
        rationale: 'Mandatory before providing AI services in China',
        specificSteps: [
          'Prepare algorithm description document',
          'Conduct security self-assessment',
          'Implement content filtering for Chinese regulations',
          'Establish real-name user verification',
          'Prepare for ongoing content monitoring obligations'
        ]
      });
    }

    // Training recommendations
    recommendations.push({
      priority: 'MEDIUM',
      category: 'Staff Training',
      action: 'Develop AI literacy and compliance training programs',
      rationale: 'Staff awareness critical for maintaining compliance',
      trainingTopics: [
        'Applicable AI regulations and company obligations',
        'Data protection principles and requirements',
        'Bias detection and fairness considerations',
        'Incident reporting procedures',
        'User interaction and transparency requirements',
        'Security and privacy best practices'
      ]
    });

    return recommendations;
  }

  estimateTimeline(complianceRequirements) {
    const timeline = {
      immediate: [],
      shortTerm: [],
      mediumTerm: [],
      ongoing: []
    };

    complianceRequirements.forEach(reqCategory => {
      reqCategory.requirements.forEach(req => {
        if (req.timeline) {
          if (req.timeline.includes('Before') || req.timeline === 'Immediate') {
            timeline.immediate.push(req.requirement);
          } else if (req.timeline === 'Ongoing') {
            timeline.ongoing.push(req.requirement);
          } else {
            timeline.mediumTerm.push(req.requirement);
          }
        }
      });
    });

    return {
      immediate: {
        description: 'Actions required before deployment or immediately (0-2 weeks)',
        items: timeline.immediate
      },
      shortTerm: {
        description: 'Initial compliance phase (2-8 weeks)',
        items: timeline.shortTerm
      },
      mediumTerm: {
        description: 'Full compliance implementation (2-6 months)',
        items: timeline.mediumTerm
      },
      ongoing: {
        description: 'Continuous compliance activities',
        items: timeline.ongoing
      }
    };
  }

  getDetailedReferences(applicableRegulations) {
    const references = [];

    applicableRegulations.forEach(reg => {
      const reference = {
        regulation: reg.regulationName,
        jurisdiction: reg.jurisdiction,
        officialSources: this.getOfficialSources(reg.regulationId),
        guidanceDocuments: this.getGuidanceDocuments(reg.regulationId),
        regulatoryAuthority: this.getRegulatoryAuthority(reg.jurisdictionkey || reg.jurisdiction)
      };
      references.push(reference);
    });

    return references;
  }

  getOfficialSources(regulationId) {
    const sources = {
      'EU-AI-ACT-2024': [
        'Regulation (EU) 2024/1689 on Artificial Intelligence',
        'Official Journal of the European Union, L 2024/1689',
        'EUR-Lex permanent link: https://eur-lex.europa.eu/eli/reg/2024/1689/oj'
      ],
      'GDPR-AI': [
        'Regulation (EU) 2016/679 (General Data Protection Regulation)',
        'EUR-Lex: https://eur-lex.europa.eu/eli/reg/2016/679/oj'
      ],
      'USA-EO-14110': [
        'Executive Order 14110 on Safe, Secure, and Trustworthy AI',
        'Federal Register / Vol. 88, No. 210',
        'WhiteHouse.gov: https://www.whitehouse.gov/briefing-room/presidential-actions/2023/10/30/executive-order-on-the-safe-secure-and-trustworthy-development-and-use-of-artificial-intelligence/'
      ]
    };

    return sources[regulationId] || ['Consult official government sources for this regulation'];
  }

  getGuidanceDocuments(regulationId) {
    const guidance = {
      'EU-AI-ACT-2024': [
        'European Commission guidance on AI Act implementation (forthcoming)',
        'EU AI Office publications',
        'National supervisory authority guidance documents'
      ],
      'GDPR-AI': [
        'EDPB Guidelines 3/2019 on processing personal data through video devices',
        'ICO guidance on AI and data protection',
        'National DPA guidance on automated decision-making'
      ]
    };

    return guidance[regulationId] || ['Check regulatory authority websites for guidance'];
  }

  getRegulatoryAuthority(jurisdiction) {
    const authorities = {
      'EU': 'European Commission, EU AI Office, National Supervisory Authorities',
      'USA': 'Sector-specific regulators (FTC, CFPB, FDA, etc.) + state attorneys general',
      'UK': 'ICO, FCA, Ofcom, CMA, MHRA, sector-specific regulators',
      'China': 'Cyberspace Administration of China (CAC)',
      'Canada': 'Proposed AI and Data Commissioner',
      'Singapore': 'PDPC (Personal Data Protection Commission)',
      'Australia': 'OAIC (Office of the Australian Information Commissioner)'
    };

    return authorities[jurisdiction] || 'Consult national regulatory authorities';
  }
}

// Initialize engine
const analysisEngine = new AIRiskAnalysisEngine(regulations, riskFramework);

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'operational',
    knowledgeBasesLoaded: true,
    version: '1.0.0'
  });
});

// Get available options for form
app.get('/api/options', (req, res) => {
  res.json({
    useCaseCategories: [
      { value: 'credit-scoring', label: 'Credit Scoring / Lending Decisions', risk: 'High' },
      { value: 'employment-decisions', label: 'Employment Screening / HR Decisions', risk: 'High' },
      { value: 'education-assessment', label: 'Educational Assessment / Admissions', risk: 'High' },
      { value: 'law-enforcement', label: 'Law Enforcement / Criminal Justice', risk: 'High' },
      { value: 'critical-infrastructure', label: 'Critical Infrastructure (Energy, Transport, Water)', risk: 'High' },
      { value: 'healthcare-diagnosis', label: 'Healthcare Diagnosis / Treatment', risk: 'Significant' },
      { value: 'insurance-underwriting', label: 'Insurance Underwriting', risk: 'Significant' },
      { value: 'content-moderation', label: 'Content Moderation', risk: 'Significant' },
      { value: 'customer-service', label: 'Customer Service Chatbot', risk: 'Moderate' },
      { value: 'marketing', label: 'Marketing / Advertising', risk: 'Moderate' },
      { value: 'recommendation-system', label: 'Recommendation System', risk: 'Moderate' },
      { value: 'business-automation', label: 'Business Process Automation', risk: 'Moderate' },
      { value: 'spam-filter', label: 'Spam Filtering', risk: 'Low' },
      { value: 'gaming', label: 'Video Game AI', risk: 'Low' },
      { value: 'research-tool', label: 'Internal Research Tool', risk: 'Low' }
    ],
    jurisdictions: [
      { value: 'EU', label: 'European Union', flag: '🇪🇺' },
      { value: 'USA', label: 'United States (Federal)', flag: '🇺🇸' },
      { value: 'California', label: 'California, USA', flag: '🇺🇸' },
      { value: 'UK', label: 'United Kingdom', flag: '🇬🇧' },
      { value: 'China', label: 'China', flag: '🇨🇳' },
      { value: 'Canada', label: 'Canada', flag: '🇨🇦' },
      { value: 'Singapore', label: 'Singapore', flag: '🇸🇬' },
      { value: 'Australia', label: 'Australia', flag: '🇦🇺' },
      { value: 'Japan', label: 'Japan', flag: '🇯🇵' },
      { value: 'South_Korea', label: 'South Korea', flag: '🇰🇷' },
      { value: 'Brazil', label: 'Brazil', flag: '🇧🇷' },
      { value: 'India', label: 'India', flag: '🇮🇳' }
    ],
    dataTypes: [
      { value: 'special_category_biometric', label: 'Biometric Data (for identification)', sensitivity: 'Critical' },
      { value: 'special_category_health', label: 'Health / Medical Data', sensitivity: 'Critical' },
      { value: 'special_category_other', label: 'Race, Religion, Political Opinion, Sexual Orientation', sensitivity: 'Critical' },
      { value: 'children_data', label: 'Children\'s Data (under 13-16)', sensitivity: 'Critical' },
      { value: 'financial_data', label: 'Financial Data / Credit Information', sensitivity: 'High' },
      { value: 'behavioral_profiles', label: 'Behavioral Profiles / Preferences', sensitivity: 'Moderate' },
      { value: 'personal_identifiable', label: 'Personal Identifiable Information', sensitivity: 'Moderate' },
      { value: 'business_data_only', label: 'Business Data Only (non-personal)', sensitivity: 'Low' },
      { value: 'anonymized_aggregated', label: 'Anonymized / Aggregated Data', sensitivity: 'Minimal' }
    ],
    decisionImpacts: [
      { value: 'life-safety', label: 'Life or Safety Critical', severity: 'Critical' },
      { value: 'legal-rights', label: 'Legal Rights / Immigration / Justice', severity: 'Critical' },
      { value: 'significant-economic', label: 'Major Economic Impact (loans, employment, housing)', severity: 'High' },
      { value: 'moderate-economic', label: 'Moderate Economic Impact (pricing, opportunities)', severity: 'Moderate' },
      { value: 'limited-impact', label: 'Limited Impact (recommendations, rankings)', severity: 'Low' },
      { value: 'no-impact', label: 'No Direct Individual Impact', severity: 'Minimal' }
    ],
    industries: [
      { value: 'financial-services', label: 'Financial Services' },
      { value: 'healthcare', label: 'Healthcare' },
      { value: 'education', label: 'Education' },
      { value: 'government', label: 'Government / Public Sector' },
      { value: 'retail', label: 'Retail / E-commerce' },
      { value: 'technology', label: 'Technology' },
      { value: 'manufacturing', label: 'Manufacturing' },
      { value: 'transportation', label: 'Transportation' },
      { value: 'telecommunications', label: 'Telecommunications' },
      { value: 'other', label: 'Other' }
    ]
  });
});

// Main risk analysis endpoint
app.post('/api/analyze', (req, res) => {
  try {
    const analysis = analysisEngine.analyzeRisk(req.body);
    res.json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ 
      error: 'Analysis failed', 
      details: error.message 
    });
  }
});

// Get regulation details
app.get('/api/regulations/:region', (req, res) => {
  const region = req.params.region.toUpperCase();
  const regionData = regulations.regions[region];
  
  if (regionData) {
    res.json(regionData);
  } else {
    res.status(404).json({ error: 'Region not found' });
  }
});

// Get all regulations summary
app.get('/api/regulations', (req, res) => {
  const summary = Object.keys(regulations.regions).map(key => ({
    code: key,
    name: regulations.regions[key].name,
    primaryRegulation: regulations.regions[key].primary_regulation,
    regulationCount: regulations.regions[key].regulations?.length || 0
  }));
  
  res.json(summary);
});

// Get risk framework documentation
app.get('/api/framework', (req, res) => {
  res.json(riskFramework);
});

// Search knowledge base
app.post('/api/search', (req, res) => {
  const { query } = req.body;
  const results = [];
  
  // Search through regulations
  Object.values(regulations.regions).forEach(region => {
    region.regulations?.forEach(reg => {
      const searchText = JSON.stringify(reg).toLowerCase();
      if (searchText.includes(query.toLowerCase())) {
        results.push({
          type: 'regulation',
          region: region.name,
          regulation: reg.name,
          relevantContent: reg
        });
      }
    });
  });
  
  res.json({ query, results, count: results.length });
});

app.listen(PORT, () => {
  console.log(`\n🚀 AI Risk Analysis Engine Backend Running`);
  console.log(`📊 Server: http://localhost:${PORT}`);
  console.log(`📚 Knowledge Base: Loaded with ${Object.keys(regulations.regions).length} jurisdictions`);
  console.log(`⚡ Ready to analyze AI risks\n`);
});

module.exports = app;