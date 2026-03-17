document.addEventListener('DOMContentLoaded', () => {
    // --- UI Elements ---
    const views = {
        intake: document.getElementById('intake-view'),
        loading: document.getElementById('loading-view'),
        report: document.getElementById('report-view')
    };
    
    const intakeForm = document.getElementById('intake-form');
    const logsContainer = document.getElementById('loading-logs');
    const reportTabs = document.querySelectorAll('.tab-item');
    const moduleContents = document.querySelectorAll('.module-content');
    const actionModes = document.querySelectorAll('.action-mode');

    // Settings Modal Elements
    const settingsModal = document.getElementById('settings-modal');
    const btnSettings = document.getElementById('btn-settings');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const btnCancelSettings = document.getElementById('btn-cancel-settings');
    const btnSaveSettings = document.getElementById('btn-save-settings');
    const apiKeyInput = document.getElementById('api-key');

    // --- State ---
    let currentReportType = 'full';
    let lastGeneratedReport = null; // Store for sharing
    let lastFormData = null; // Store for sharing
    let geminiApiKey = localStorage.getItem('gemini_api_key') || '';
    if (geminiApiKey) apiKeyInput.value = geminiApiKey;

    // --- View Controller ---
    function switchView(viewName) {
        Object.values(views).forEach(v => v.classList.remove('active'));
        views[viewName].classList.add('active');
    }

    // --- Settings Logic ---
    function toggleSettings(show) {
        if (show) {
            settingsModal.classList.add('active');
        } else {
            settingsModal.classList.remove('active');
        }
    }

    btnSettings.addEventListener('click', () => toggleSettings(true));
    btnCloseSettings.addEventListener('click', () => toggleSettings(false));
    btnCancelSettings.addEventListener('click', () => toggleSettings(false));
    
    btnSaveSettings.addEventListener('click', () => {
        geminiApiKey = apiKeyInput.value.trim();
        localStorage.setItem('gemini_api_key', geminiApiKey);
        toggleSettings(false);
        // Toast or visual confirmation could go here
    });

    // --- Tab Logic ---
    reportTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            reportTabs.forEach(t => t.classList.remove('active'));
            moduleContents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            const targetId = `tab-${tab.getAttribute('data-tab')}`;
            const targetContent = document.getElementById(targetId);
            if(targetContent) {
                targetContent.classList.add('active');
            }
        });
    });

    // --- Action Modes ---
    actionModes.forEach(modeBtn => {
        modeBtn.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
            modeBtn.classList.add('active');
            
            const mode = modeBtn.getAttribute('data-mode');
            currentReportType = mode;
            switchView('intake');
            
            if(mode === 'rapid') {
                document.querySelector('.section-header h1').textContent = "Rapid Brief Protocol";
                document.getElementById('horizon').value = 'current';
            } else if (mode === 'teardown') {
                document.querySelector('.section-header h1').textContent = "Competitive Teardown Protocol";
                document.getElementById('question').placeholder = "e.g. Analyze Razorpay vs PayU";
            }
        });
    });

    // --- LLM Integration ---

    // System prompt based on the user's requirements + formatting instructions
    const SYSTEM_PROMPT = `
You are an elite AI Market Research Analyst operating at the standard of a Big 4 consulting firm combined with top-tier strategy houses.
Every output must be Fact-grounded, Structured, Actionable, India-aware (where applicable), and Decision-ready.

You are performing a live market research scan. Use Search Grounding to find the latest real-world data, financial figures, competitor ARR, and market sizing. Do NOT hallucinate data.

You must reply ONLY with a valid JSON object matching this exact structure:

{
  "meta_confidence": "HIGH",
  "exec_summary": {
    "bottom_line": "1-sentence overarching conclusion",
    "situation": "2-3 sentences on the current reality",
    "complication": "2-3 sentences on the core tension",
    "resolution": "2-3 sentences on what the company must do",
    "headlines": [
      { "text": "Finding 1...", "confidence": "HIGH" },
      { "text": "Finding 2...", "confidence": "MEDIUM" },
      { "text": "Finding 3...", "confidence": "HIGH" }
    ]
  },
  "market_sizing": {
    "implication": "1-sentence so-what",
    "tam": "$10B",
    "sam": "$2B",
    "som": "$100M"
  },
  "competitors": {
    "implication": "1-sentence so-what on competitive landscape",
    "players": [
      { "name": "Company A", "badge": "Market Leader", "arr": "$1B+", "hq": "Mumbai", "moat": "Network effects..." },
      { "name": "Company B", "badge": "Scaling Challenger", "arr": "$50M", "hq": "Bengaluru", "moat": "Better tech..." }
    ]
  },
  "swot": {
    "strengths": ["line 1", "line 2", "line 3"],
    "weaknesses": ["line 1", "line 2", "line 3"],
    "opportunities": ["line 1", "line 2", "line 3"],
    "threats": ["line 1", "line 2", "line 3"]
  },
  "pestle": {
    "political": ["point 1", "point 2"],
    "economic": ["point 1", "point 2"],
    "social": ["point 1", "point 2"],
    "technological": ["point 1", "point 2"],
    "legal": ["point 1", "point 2"],
    "environmental": ["point 1", "point 2"]
  },
  "porters": {
    "conclusion": "1 sentence takeaway",
    "threat_of_new_entrants": { "score": "HIGH", "reason": "reasoning..." },
    "supplier_power": { "score": "CRITICAL", "reason": "reasoning..." },
    "competitive_rivalry": { "score": "HIGH", "reason": "reasoning..." },
    "buyer_power": { "score": "MEDIUM", "reason": "reasoning..." },
    "threat_of_substitutes": { "score": "LOW", "reason": "reasoning..." }
  },
  "bcg": {
    "stars": ["product 1", "product 2"],
    "question_marks": ["product 1", "product 2"],
    "cash_cows": ["product 1", "product 2"],
    "dogs": ["product 1", "product 2"]
  },
  "mckinsey": {
    "shared_values": "value 1, value 2",
    "strategy": "strategic focus",
    "structure": "org structure",
    "systems": "core systems",
    "staff": "staffing layout",
    "skills": "core competencies",
    "style": "culture style"
  }
}
`;

    function addLogLine(msg, type = 'info') {
        const p = document.createElement('p');
        p.className = `log-line ${type}`;
        const prefix = type === 'success' ? '[OK]' : type === 'warn' ? '[!]' : '[*]';
        p.textContent = `${prefix} ${msg}`;
        logsContainer.appendChild(p);
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }

    async function callGeminiAPI(formData) {
        if (!geminiApiKey) {
            alert("Please configure your Gemini API Key in Settings first.");
            switchView('intake');
            toggleSettings(true);
            return;
        }

        logsContainer.innerHTML = '';
        addLogLine("Initializing Gemini 1.5 Pro with Search Grounding...", "info");

        // Construct the prompt
        const userPrompt = `
Perform the intake protocol and generate the report.
Sector: ${formData.sector}
Question: ${formData.question}
Audience: ${formData.audience}
Position: ${formData.position}
Geography: ${formData.geo}
Horizon: ${formData.horizon}
Mode: ${currentReportType}
`;

        addLogLine("Building constraints and formulating search queries...", "success");

        // Dynamically find the best available model for this API key
        addLogLine("Retrieving available models for your API context...", "info");
        let targetModel = 'gemini-1.5-pro-latest'; // Fallback
        
        try {
            const modelsResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`);
            if (modelsResponse.ok) {
                const modelsData = await modelsResponse.json();
                const availableModels = modelsData.models
                    .filter(m => m.supportedGenerationMethods.includes("generateContent"))
                    .map(m => m.name.replace('models/', ''));
                
                console.log("Available Gemini Models:", availableModels);
                
                // Prioritize models with highest free tier allowances
                const preferredModels = [
                    "gemini-1.5-flash-latest",
                    "gemini-1.5-flash",
                    "gemini-2.5-flash", 
                    "gemini-1.5-pro-latest",
                    "gemini-2.5-pro"
                ];
                
                let foundModel = false;
                for (const pref of preferredModels) {
                    if (availableModels.includes(pref)) {
                        targetModel = pref;
                        foundModel = true;
                        break;
                    }
                }
                
                // Fallback to any gemini model if exact matches not found
                if (!foundModel) {
                    const fallback = availableModels.find(m => m.includes("gemini"));
                    if (fallback) targetModel = fallback;
                }
                addLogLine(`Selected optimal model: ${targetModel}`, "success");
            } else {
                addLogLine("Could not retrieve model list, using default...", "warn");
            }
        } catch (e) {
            console.error("Model fetch error:", e);
            addLogLine("Error retrieving model list, using default.", "warn");
        }

        const requestBody = {
            systemInstruction: {
                parts: [{ text: SYSTEM_PROMPT }]
            },
            contents: [{
                role: "user",
                parts: [{ text: userPrompt }]
            }],
            tools: [{
                googleSearch: {}
            }],
            generationConfig: {
                temperature: 0.2
            }
        };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errData = await response.json();
            const errMsg = errData.error?.message || "API Request Failed";
            if (response.status === 429) {
                 addLogLine(`Google API Error: Free Tier Quota Exceeded for ${targetModel}. Try again later.`, "warn");
            } else {
                 addLogLine(`API Error: ${errMsg}`, "warn");
            }
            throw new Error(errMsg);
        }

        try {
            const data = await response.json();
            const rawText = data.candidates && data.candidates[0]?.content?.parts[0]?.text;
            
            if (!rawText) {
                addLogLine("API Error: Received empty or invalid response structure from Google.", "warn");
                console.error("Raw API Response:", data);
                return;
            }

            addLogLine("Data retrieved. Parsing structural output...", "success");
            
            // Clean markdown formatting if present
            let cleanText = rawText;
            const jsonStart = cleanText.indexOf('{');
            const jsonEnd = cleanText.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1) {
                cleanText = cleanText.substring(jsonStart, jsonEnd + 1);
            }
            
            const jsonResp = JSON.parse(cleanText);
            addLogLine("Intelligence package compilation complete.", "success");
            
            setTimeout(() => {
                lastGeneratedReport = jsonResp;
                lastFormData = formData;
                populateReport(jsonResp, formData);
                switchView('report');
                document.querySelector('[data-tab="exec"]').click();
            }, 1000);
        } catch (e) {
             addLogLine(`Execution Error: ${e.message}`, "warn");
             console.error("Full Execution Error:", e);
        }
    }
    function populateReport(data, formData) {
        // Helper to consistently populate lists
        const populateUl = (selector, items) => {
            const ul = document.querySelector(selector);
            if(!ul) return;
            ul.innerHTML = '';
            if(!items) return;
            items.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item;
                ul.appendChild(li);
            });
        };

        // Headers
        document.getElementById('report-title-val').textContent = `Intelligence: ${formData.sector}`;
        
        const geoSelect = document.getElementById('geo');
        const horizonSelect = document.getElementById('horizon');
        
        if (geoSelect && geoSelect.querySelector(`option[value="${formData.geo}"]`)) geoSelect.value = formData.geo;
        if (horizonSelect && horizonSelect.querySelector(`option[value="${formData.horizon}"]`)) horizonSelect.value = formData.horizon;

        if (document.getElementById('report-geo-val')) {
            document.getElementById('report-geo-val').textContent = geoSelect?.options[geoSelect.selectedIndex]?.text || formData.geo;
        }
        if (document.getElementById('report-time-val')) {
            document.getElementById('report-time-val').textContent = horizonSelect?.options[horizonSelect.selectedIndex]?.text || formData.horizon;
        }
        
        // Exec Summary
        if (data.exec_summary) {
            const soWhatBox = document.querySelector('#tab-exec .so-what-box strong');
            if (soWhatBox && soWhatBox.nextSibling) {
                soWhatBox.nextSibling.textContent = ' ' + (data.exec_summary.bottom_line || '');
            }
            const structureCards = document.querySelectorAll('#tab-exec .structure-card p');
            if(structureCards.length >= 3) {
                structureCards[0].textContent = data.exec_summary.situation || '';
                structureCards[1].textContent = data.exec_summary.complication || '';
                structureCards[2].textContent = data.exec_summary.resolution || '';
            }

            const headlineUl = document.querySelector('.headline-list');
            if (headlineUl) {
                headlineUl.innerHTML = '';
                (data.exec_summary.headlines || []).forEach((hl, idx) => {
                    const li = document.createElement('li');
                    li.innerHTML = `<span class="num">${idx + 1}.</span> ${hl.text} <span class="conf-badge ${(hl.confidence || 'HIGH').toLowerCase() === 'high' ? 'high' : 'med'}">${hl.confidence || 'HIGH'}</span>`;
                    headlineUl.appendChild(li);
                });
            }
        }

        // Market Sizing
        if (data.market_sizing) {
            const mktSoWhat = document.querySelector('#tab-market .so-what-box strong');
            if (mktSoWhat && mktSoWhat.nextSibling) {
                mktSoWhat.nextSibling.textContent = ' ' + (data.market_sizing.implication || '');
            }
            const metrics = document.querySelectorAll('.metric-value');
            if(metrics.length >= 3) {
                metrics[0].textContent = data.market_sizing.tam || '';
                metrics[1].textContent = data.market_sizing.sam || '';
                metrics[2].textContent = data.market_sizing.som || '';
            }
        }

        // Competitors
        if (data.competitors && data.competitors.players) {
            const compSoWhat = document.querySelector('#tab-competitive .so-what-box strong');
            if (compSoWhat && compSoWhat.nextSibling) {
                compSoWhat.nextSibling.textContent = ' ' + (data.competitors.implication || '');
            }
            const compGrid = document.querySelector('.competitor-grid');
            if (compGrid) {
                compGrid.innerHTML = '';
                data.competitors.players.forEach(player => {
                    const badgeClass = (player.badge || '').toLowerCase().includes('leader') ? 'leader' : 'scaling';
                    const html = `
                        <div class="competitor-card">
                            <div class="comp-header">
                                <div class="comp-logo-placeholder" style="background: var(--accent-${Math.random() > 0.5 ? 'primary' : 'secondary'})">${(player.name || '?').charAt(0)}</div>
                                <div>
                                    <h4>${player.name || 'Unknown'}</h4>
                                    <span class="comp-badge ${badgeClass}">${player.badge || 'Competitor'}</span>
                                </div>
                            </div>
                            <div class="comp-stats">
                                <div class="stat"><span class="label">Est. ARR</span><span class="val">${player.arr || 'N/A'}</span></div>
                                <div class="stat"><span class="label">HQ</span><span class="val">${player.hq || 'N/A'}</span></div>
                            </div>
                            <p class="comp-moat"><strong>Moat:</strong> ${player.moat || 'N/A'}</p>
                        </div>
                    `;
                    compGrid.innerHTML += html;
                });
            }
        }

        // SWOT
        if (data.swot) {
            populateUl('.swot-quadrant:nth-child(1) ul', data.swot.strengths);
            populateUl('.swot-quadrant:nth-child(2) ul', data.swot.weaknesses);
            populateUl('.swot-quadrant:nth-child(3) ul', data.swot.opportunities);
            populateUl('.swot-quadrant:nth-child(4) ul', data.swot.threats);
        }

        // PESTLE
        if(data.pestle) {
            populateUl('.pestle-card:nth-child(1) ul', data.pestle.political);
            populateUl('.pestle-card:nth-child(2) ul', data.pestle.economic);
            populateUl('.pestle-card:nth-child(3) ul', data.pestle.social);
            populateUl('.pestle-card:nth-child(4) ul', data.pestle.technological);
            populateUl('.pestle-card:nth-child(5) ul', data.pestle.legal);
            populateUl('.pestle-card:nth-child(6) ul', data.pestle.environmental);
        }

        // Porter's Five Forces
        if(data.porters) {
            const safeSelect = (selector, text) => {
                const el = document.querySelector(selector);
                if(el) el.textContent = text;
            };
            
            safeSelect('#tab-porters .so-what-box strong', 'Conclusion:');
            const pbox = document.querySelector('#tab-porters .so-what-box');
            if(pbox) pbox.innerHTML = `<strong>Conclusion:</strong> ${data.porters.conclusion || ''}`;

            const updatePorterNode = (nodeClass, pData) => {
                const node = document.querySelector(`.porter-node.${nodeClass}`);
                if(!node || !pData) return;
                
                node.classList.remove('risk-low', 'risk-med', 'risk-high', 'risk-critical');
                const score = (pData.score || 'MEDIUM').toUpperCase();
                let riskClass = 'risk-med';
                if(score === 'LOW') riskClass = 'risk-low';
                else if(score === 'HIGH') riskClass = 'risk-high';
                else if(score === 'CRITICAL') riskClass = 'risk-critical';
                
                node.classList.add(riskClass);
                const scoreEl = node.querySelector('.porter-score');
                if (scoreEl) scoreEl.textContent = score;
                const pEl = node.querySelector('p');
                if (pEl) pEl.textContent = pData.reason || '';
            };

            updatePorterNode('top', data.porters.threat_of_new_entrants);
            updatePorterNode('left', data.porters.supplier_power);
            updatePorterNode('center', data.porters.competitive_rivalry);
            updatePorterNode('right', data.porters.buyer_power);
            updatePorterNode('bottom', data.porters.threat_of_substitutes);
        }

        // BCG Matrix
        if(data.bcg) {
            populateUl('.bcg-quadrant.stars ul', data.bcg.stars);
            populateUl('.bcg-quadrant.question-marks ul', data.bcg.question_marks);
            populateUl('.bcg-quadrant.cash-cows ul', data.bcg.cash_cows);
            populateUl('.bcg-quadrant.dogs ul', data.bcg.dogs);
        }

        // McKinsey 7S
        if(data.mckinsey) {
            const mckCards = document.querySelectorAll('.mck-card p');
            if(mckCards.length >= 7) {
                mckCards[0].textContent = data.mckinsey.shared_values || '';
                mckCards[1].textContent = data.mckinsey.strategy || '';
                mckCards[2].textContent = data.mckinsey.structure || '';
                mckCards[3].textContent = data.mckinsey.systems || '';
                mckCards[4].textContent = data.mckinsey.staff || '';
                mckCards[5].textContent = data.mckinsey.skills || '';
                mckCards[6].textContent = data.mckinsey.style || '';
            }
        }
    }

    // --- Sharing Logic ---
    function showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('active');
        setTimeout(() => toast.classList.remove('active'), 3000);
    }

    function generateShareableLink() {
        if (!lastGeneratedReport || !lastFormData) {
            alert("Please generate a report first.");
            return;
        }

        const payload = {
            data: lastGeneratedReport,
            meta: lastFormData
        };

        try {
            const jsonStr = JSON.stringify(payload);
            const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
            const url = `${window.location.origin}${window.location.pathname}#report=${encoded}`;
            
            navigator.clipboard.writeText(url).then(() => {
                showToast("Shareable link copied to clipboard!");
            }).catch(err => {
                console.error("Clipboard Error:", err);
                alert("Could not copy link. Manually copy the URL from your browser.");
            });
        } catch (e) {
            console.error("Serialization Error:", e);
            alert("Error creating shareable link.");
        }
    }

    function checkUrlForSharedReport() {
        const hash = window.location.hash;
        if (hash && hash.startsWith('#report=')) {
            const encoded = hash.substring(8);
            try {
                const jsonStr = decodeURIComponent(escape(atob(encoded)));
                const payload = JSON.parse(jsonStr);
                
                addLogLine("Shared report detected. Initializing dashboard...", "info");
                switchView('loading');
                
                setTimeout(() => {
                    lastGeneratedReport = payload.data;
                    lastFormData = payload.meta;
                    populateReport(payload.data, payload.meta);
                    switchView('report');
                    document.querySelector('[data-tab="exec"]').click();
                    addLogLine("Shared intelligence report loaded successfully.", "success");
                }, 1500);
            } catch (e) {
                console.error("Link Decoding Error:", e);
                addLogLine("Error: Could not decode shared link.", "warn");
            }
        }
    }

    document.getElementById('btn-share-report').addEventListener('click', generateShareableLink);

    // Check for shared reports on startup
    checkUrlForSharedReport();

    // Handle Form Submission
    intakeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = {
            sector: document.getElementById('sector').value,
            question: document.getElementById('question').value,
            audience: document.getElementById('audience').value,
            position: document.getElementById('position').value,
            geo: document.getElementById('geo').value,
            horizon: document.getElementById('horizon').value,
        };

        switchView('loading');
        callGeminiAPI(formData);
    });
});
