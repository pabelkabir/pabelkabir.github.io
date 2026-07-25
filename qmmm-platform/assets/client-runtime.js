(function () {
  "use strict";

  var nativeFetch = window.fetch.bind(window);
  var studies = new Map();
  var aminoAcids = new Set([
    "ALA", "ARG", "ASN", "ASP", "CYS", "GLN", "GLU", "GLY", "HIS", "ILE",
    "LEU", "LYS", "MET", "PHE", "PRO", "SER", "THR", "TRP", "TYR", "VAL"
  ]);
  var waters = new Set(["HOH", "SOL", "WAT"]);
  var charged = new Set(["ARG", "ASP", "GLU", "HIS", "LYS"]);
  var polar = new Set([
    "ARG", "ASN", "ASP", "CYS", "GLN", "GLU", "HIS", "LYS", "SER", "THR", "TYR"
  ]);
  var aromatic = new Set(["HIS", "PHE", "TRP", "TYR"]);
  var redoxActive = new Set(["CYS", "HIS", "MET", "TRP", "TYR"]);
  var flavins = {
    FMN: "Flavin mononucleotide",
    FAD: "Flavin adenine dinucleotide"
  };
  var propertyWeights = {
    absorption: {
      charged: 14, polar: 14, aromatic: 16, "redox-active": 6, water: 5, ligand: 10
    },
    fluorescence: {
      charged: 18, polar: 18, aromatic: 16, "redox-active": 8, water: 8, ligand: 12
    },
    mechanism: {
      charged: 22, polar: 20, aromatic: 8, "redox-active": 18, water: 15, ligand: 22
    },
    redox: {
      charged: 24, polar: 16, aromatic: 15, "redox-active": 24, water: 8, ligand: 18
    },
    "electron-transfer": {
      charged: 16, polar: 10, aromatic: 24, "redox-active": 28, water: 5, ligand: 24
    },
    pcet: {
      charged: 24, polar: 24, aromatic: 10, "redox-active": 20, water: 20, ligand: 18
    }
  };

  function jsonResponse(payload, status) {
    return new Response(JSON.stringify(payload), {
      status: status || 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  function requestBody(options) {
    try {
      return JSON.parse((options && options.body) || "{}");
    } catch (error) {
      throw new Error("The request contains invalid JSON.");
    }
  }

  function safeFilename(value) {
    var leaf = String(value || "structure.pdb").split(/[\\/]/).pop();
    return leaf.replace(/[^A-Za-z0-9._-]/g, "_") || "structure.pdb";
  }

  function randomId() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return "browser-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  function hashValue(value) {
    var text = JSON.stringify(value);
    var hash = 2166136261;
    for (var index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return ("00000000" + (hash >>> 0).toString(16)).slice(-8);
  }

  function atomElement(atomName, field) {
    var explicit = String(field || "").trim().toUpperCase();
    if (explicit) {
      return explicit;
    }
    return String(atomName || "").replace(/[^A-Za-z]/g, "").slice(0, 1).toUpperCase();
  }

  function parsePdb(structure, filename) {
    if (!String(structure || "").trim()) {
      throw new Error("The structure file is empty.");
    }
    if (new Blob([structure]).size > 25 * 1024 * 1024) {
      throw new Error("The structure exceeds the 25 MB browser limit.");
    }

    var grouped = new Map();
    String(structure).split(/\r?\n/).forEach(function (line, lineIndex) {
      var record = line.slice(0, 6).trim();
      if (record !== "ATOM" && record !== "HETATM") {
        return;
      }
      if (line.length < 54) {
        throw new Error(
          safeFilename(filename) + ":" + (lineIndex + 1) + " is a truncated PDB record."
        );
      }
      var alternate = line.slice(16, 17);
      if (alternate !== " " && alternate !== "A") {
        return;
      }
      var name = line.slice(17, 20).trim().toUpperCase();
      var chain = line.slice(21, 22).trim() || "_";
      var number = line.slice(22, 26).trim();
      var insertion = line.slice(26, 27).trim();
      var x = Number(line.slice(30, 38));
      var y = Number(line.slice(38, 46));
      var z = Number(line.slice(46, 54));
      if (![x, y, z].every(Number.isFinite)) {
        throw new Error(
          safeFilename(filename) + ":" + (lineIndex + 1) + " has invalid coordinates."
        );
      }
      var key = [chain, number, insertion, name].join("|");
      if (!grouped.has(key)) {
        grouped.set(key, {
          chain: chain,
          number: number,
          insertion: insertion,
          name: name,
          selector: chain + ":" + number + insertion,
          label: chain + ":" + number + insertion + ":" + name,
          atoms: []
        });
      }
      grouped.get(key).atoms.push({
        name: line.slice(12, 16).trim(),
        element: atomElement(line.slice(12, 16), line.slice(76, 78)),
        x: x,
        y: y,
        z: z
      });
    });

    if (!grouped.size) {
      throw new Error("No ATOM or HETATM records were found in the PDB file.");
    }
    return Array.from(grouped.values());
  }

  function heavyAtomCount(residue) {
    return residue.atoms.filter(function (atom) {
      return atom.element !== "H" && atom.element !== "D";
    }).length;
  }

  function cofactorRecord(residue, detected) {
    return {
      component_id: residue.name,
      component_name: flavins[residue.name] || residue.name,
      selector: residue.selector,
      label: residue.label,
      chain: residue.chain,
      number: residue.number + residue.insertion,
      resolved_atom_count: residue.atoms.length,
      resolved_heavy_atom_count: heavyAtomCount(residue),
      is_detected_flavin: Boolean(detected),
      detection_basis: detected ? "exact-pdb-chemical-component-id" : undefined,
      requires_user_confirmation: Boolean(detected)
    };
  }

  function analyzeStructure(structure, filename) {
    var residues = parsePdb(structure, filename);
    var detected = residues.filter(function (residue) {
      return Boolean(flavins[residue.name]);
    }).map(function (residue) {
      return cofactorRecord(residue, true);
    });
    var ligands = residues.filter(function (residue) {
      return !aminoAcids.has(residue.name) && !waters.has(residue.name);
    }).map(function (residue) {
      return cofactorRecord(residue, Boolean(flavins[residue.name]));
    });
    var chains = Array.from(new Set(residues.map(function (residue) {
      return residue.chain;
    }))).sort();

    return {
      analysis: {
        filename: safeFilename(filename),
        format: "PDB",
        atom_count: residues.reduce(function (total, residue) {
          return total + residue.atoms.length;
        }, 0),
        residue_count: residues.length,
        chain_count: chains.length,
        chains: chains,
        detected_flavins: detected,
        ligands: ligands,
        detection_message: detected.length
          ? "Detected " + detected.length + " FMN/FAD component" +
            (detected.length === 1 ? "" : "s") + "; user confirmation is required."
          : "No exact FMN or FAD component was detected; select a ligand."
      },
      residues: residues
    };
  }

  function residueCategories(residue) {
    var categories = [];
    if (charged.has(residue.name)) categories.push("charged");
    if (polar.has(residue.name)) categories.push("polar");
    if (aromatic.has(residue.name)) categories.push("aromatic");
    if (redoxActive.has(residue.name)) categories.push("redox-active");
    if (waters.has(residue.name)) categories.push("water");
    if (!aminoAcids.has(residue.name) && !waters.has(residue.name)) categories.push("ligand");
    return categories;
  }

  function closestContact(first, second) {
    var best = null;
    first.atoms.forEach(function (left) {
      if (left.element === "H" || left.element === "D") return;
      second.atoms.forEach(function (right) {
        if (right.element === "H" || right.element === "D") return;
        var dx = left.x - right.x;
        var dy = left.y - right.y;
        var dz = left.z - right.z;
        var distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (!best || distance < best.distance) {
          best = { distance: distance, chromophoreAtom: left, residueAtom: right };
        }
      });
    });
    if (!best) {
      throw new Error("A selected residue contains no heavy atoms.");
    }
    return best;
  }

  function distanceScore(distance, inner, outer) {
    if (distance <= inner) {
      return 55 + 15 * Math.max(0, (inner - distance) / inner);
    }
    if (distance <= outer) {
      return 20 + 35 * (outer - distance) / (outer - inner);
    }
    return 0;
  }

  function evidenceFor(residue, contact, categories) {
    var evidence = [
      "Closest heavy-atom contact is " + contact.distance.toFixed(2) +
      " A (" + residue.name + " " + contact.residueAtom.name +
      " to chromophore " + contact.chromophoreAtom.name + ")."
    ];
    if (
      contact.distance <= 3.5 &&
      ["N", "O", "S"].includes(contact.chromophoreAtom.element) &&
      ["N", "O", "S"].includes(contact.residueAtom.element)
    ) {
      evidence.push(
        "Geometry is compatible with a possible hydrogen-bond or proton-transfer contact; directionality still requires review."
      );
    }
    if (categories.includes("charged")) {
      evidence.push("Charged or titratable side chain may alter the local electric field.");
    }
    if (categories.includes("aromatic") && contact.distance <= 5) {
      evidence.push("Aromatic side chain may affect pi or electronic coupling.");
    }
    if (categories.includes("redox-active")) {
      evidence.push("Residue type can participate in electron or proton-coupled transfer.");
    }
    if (categories.includes("water")) {
      evidence.push("Water may bridge a hydrogen-bond or proton-transfer network.");
    }
    if (categories.includes("ligand")) {
      evidence.push("Non-protein residue may be a substrate, cofactor, or bound ligand.");
    }
    return evidence;
  }

  function adviseRegion(record) {
    var inputs = record.state.user_inputs;
    var inner = Number(inputs.inner_cutoff_angstrom);
    var outer = Number(inputs.outer_cutoff_angstrom);
    if (!(inner > 0 && outer > inner)) {
      throw new Error("Cutoffs must satisfy 0 < inner < outer.");
    }
    var chromophore = record.residues.find(function (residue) {
      return (
        residue.name === inputs.chromophore_resname &&
        residue.chain === inputs.chromophore_chain &&
        residue.number + residue.insertion === inputs.chromophore_number
      );
    });
    if (!chromophore) {
      throw new Error("The confirmed chromophore is not present in this structure.");
    }

    var required = new Set(inputs.reacting_residues || []);
    required.forEach(function (selector) {
      if (!record.residues.some(function (residue) { return residue.selector === selector; })) {
        throw new Error("Required reacting residue was not found: " + selector + ".");
      }
    });

    var weights = propertyWeights[inputs.property_target];
    var candidates = [];
    record.residues.forEach(function (residue) {
      if (residue.label === chromophore.label) return;
      var isRequired = required.has(residue.selector);
      var contact = closestContact(chromophore, residue);
      if (contact.distance > outer && !isRequired) return;
      var categories = residueCategories(residue);
      var score = distanceScore(contact.distance, inner, outer);
      categories.forEach(function (category) {
        score += weights[category] || 0;
      });
      if (isRequired) score = Math.max(score, 100);
      score = Math.round(Math.min(score, 100) * 10) / 10;
      var recommendation = "environment-only";
      if (isRequired) recommendation = "required-by-user";
      else if (score >= 70) recommendation = "strong-candidate-for-user-review";
      else if (score >= 45) recommendation = "candidate-for-user-review";
      candidates.push({
        residue: residue.label,
        selector: residue.selector,
        residue_type: residue.name,
        minimum_distance_angstrom: Math.round(contact.distance * 1000) / 1000,
        distance_shell: contact.distance <= inner
          ? "0-" + inner + " A"
          : contact.distance <= outer
            ? inner + "-" + outer + " A"
            : "outside " + outer + " A; retained because user-required",
        categories: categories,
        score: score,
        recommendation: recommendation,
        required_by_user: isRequired,
        estimated_added_heavy_atoms: heavyAtomCount(residue),
        evidence: evidenceFor(residue, contact, categories)
      });
    });
    candidates.sort(function (left, right) {
      if (left.required_by_user !== right.required_by_user) {
        return left.required_by_user ? -1 : 1;
      }
      return right.score - left.score ||
        left.minimum_distance_angstrom - right.minimum_distance_angstrom ||
        left.residue.localeCompare(right.residue);
    });
    var requiredCandidates = candidates.filter(function (candidate) {
      return candidate.required_by_user;
    });
    var optionalCandidates = candidates.filter(function (candidate) {
      return !candidate.required_by_user;
    });
    candidates = requiredCandidates.concat(
      optionalCandidates.slice(0, Math.max(0, 15 - requiredCandidates.length))
    );
    var proposed = candidates.filter(function (candidate) {
      return ["required-by-user", "strong-candidate-for-user-review"]
        .includes(candidate.recommendation);
    });
    var needsReaction =
      inputs.property_target === "mechanism" && required.size === 0;
    var questions = [
      "Which proposed residues and waters do you approve for the QM region?",
      "Confirm the total QM-region charge and spin multiplicity after selection.",
      "Should amino acids be represented as full residues or side-chain fragments?"
    ];
    if (needsReaction) {
      questions.unshift(
        "Which residues, waters, or substrate atoms participate in the proposed reaction?"
      );
    }
    return {
      schema_version: 1,
      agent: "qm-region-advisor",
      status: needsReaction ? "needs-user-input" : "awaiting-user-approval",
      observation: {
        chromophore: chromophore.label,
        property_target: inputs.property_target,
        user_defined_redox_state: inputs.redox_state,
        inner_cutoff_angstrom: inner,
        outer_cutoff_angstrom: outer,
        reacting_residues_supplied_by_user: Array.from(required)
      },
      proposal: {
        baseline_region: [chromophore.label],
        candidates_for_review: candidates,
        strong_candidates_and_required: proposed.map(function (item) {
          return item.residue;
        }),
        estimated_added_heavy_atoms: proposed.reduce(function (total, item) {
          return total + item.estimated_added_heavy_atoms;
        }, 0),
        cubic_atom_count_cost_proxy: null,
        cost_proxy_warning: "Browser ranking is a structural hypothesis, not a GPU runtime prediction."
      },
      approval: {
        required: true,
        approved: false,
        agent_may_modify_qm_region: false,
        questions_for_user: questions
      },
      limitations: [
        "A single PDB cannot establish contact occupancy; repeat over representative MD frames.",
        "Distance and residue chemistry generate hypotheses, not proof of catalytic importance.",
        "Excited-state importance should be checked with NTO or density analysis.",
        "Every approved boundary requires charge, multiplicity, link-atom, energy, and gradient validation."
      ]
    };
  }

  function specialistReport(agent, status, summary, questions, payload) {
    var report = {
      schema_version: 1,
      agent: agent,
      status: status,
      summary: summary,
      findings: [],
      questions: questions || [],
      recommendations: [],
      approval_required: status === "awaiting-user-approval",
      payload: payload || {}
    };
    report.report_hash = hashValue(report);
    return report;
  }

  function buildRunPlan(record) {
    var state = record.state;
    var inputs = state.user_inputs;
    var decision = state.approvals.qm_region.decision;
    var slug = state.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    var plan = {
      schema_version: 1,
      profile: inputs.profile,
      executor: inputs.profile === "local" ? "local" : "slurm",
      config: "generated universal study overlay",
      project: slug || "qmmm-study",
      input: { kind: "browser-pdb", value: state.structure_analysis.filename },
      science: {
        cofactor: inputs.chromophore_resname,
        redox: inputs.redox_state,
        charge: String(decision.qm_charge),
        functional: "B3LYP",
        basis: "def2-TZVP",
        asec_conformations: "100",
        max_steps: "50"
      },
      resources: {
        account: inputs.profile === "expanse" ? "pabel" : "",
        partition: inputs.profile === "expanse" ? "gpu-shared" : "",
        qos: "",
        walltime: "20:00:00",
        memory: "64G",
        cpus: "8",
        gpus: "1"
      },
      run_dir: inputs.profile === "expanse"
        ? "/expanse/lustre/scratch/pabel/temp_project/qmmm-runs/" + slug
        : "runs/" + slug,
      driver: "flavin_gpu4pyscf_protocol/scripts/run_until_converged.sh",
      valid: true,
      errors: [],
      warnings: [
        "The exported browser plan must be validated by the authenticated compute gateway before launch."
      ],
      study: {
        property_target: inputs.property_target,
        redox_state: inputs.redox_state,
        qm_region: decision
      }
    };
    return plan;
  }

  function refreshStudy(record) {
    var state = record.state;
    var proposal = adviseRegion(record);
    state.specialist_reports["scientific-intake-agent"] = specialistReport(
      "scientific-intake-agent",
      proposal.status === "needs-user-input" ? "needs-user-input" : "ready",
      proposal.status === "needs-user-input"
        ? "Scientific inputs are valid, but the reaction definition is incomplete."
        : "Scientific inputs and protected redox state are internally consistent.",
      proposal.status === "needs-user-input"
        ? ["Which residues, waters, substrate atoms, or bonds participate in the reaction?"]
        : [],
      { normalized_property: state.user_inputs.property_target }
    );
    var regionReport = specialistReport(
      "qm-region-specialist-agent",
      proposal.status,
      proposal.status === "needs-user-input"
        ? "The agent needs a user-defined reaction hypothesis."
        : "QM-region candidates are ready for user review.",
      proposal.approval.questions_for_user,
      proposal
    );
    state.specialist_reports["qm-region-specialist-agent"] = regionReport;

    if (!state.approvals.qm_region.approved) {
      state.stage = proposal.status === "needs-user-input"
        ? "reaction-definition"
        : "qm-region-review";
      state.lead = {
        message: regionReport.summary,
        questions: regionReport.questions,
        next_action: proposal.status === "needs-user-input"
          ? "set-reaction"
          : "approve-region",
        user_facing_agent: "lead-agent"
      };
      return;
    }
    regionReport.status = "approved";
    regionReport.summary = "The user approved and locked the QM-region decision.";

    var plan = buildRunPlan(record);
    var planReport = specialistReport(
      "workflow-planning-agent",
      "awaiting-user-approval",
      "A reproducible run plan is ready for user approval.",
      ["Do you approve this exact scientific and resource plan?"],
      { plan: plan, plan_hash: hashValue(plan) }
    );
    state.specialist_reports["workflow-planning-agent"] = planReport;
    if (!state.approvals.run_plan.approved) {
      state.stage = "run-plan-review";
      state.lead = {
        message: planReport.summary,
        questions: planReport.questions,
        next_action: "approve-plan",
        user_facing_agent: "lead-agent"
      };
      return;
    }
    planReport.status = "approved";
    planReport.summary = "The user approved the exact scientific and resource plan.";

    state.specialist_reports["execution-agent"] = specialistReport(
      "execution-agent",
      "blocked",
      "Study design is complete; the public browser is not connected to an authenticated Expanse gateway.",
      ["Export the approved study record for validation and submission on Expanse."],
      { browser_launch_enabled: false }
    );
    state.stage = "implementation-blocked";
    state.lead = {
      message: "Your study plan is approved and ready to export. No GPU job was submitted.",
      questions: ["Export the study JSON and validate it through the Expanse control plane."],
      next_action: "export-study",
      user_facing_agent: "lead-agent"
    };
  }

  function studyResponse(record) {
    return {
      study_id: record.state.study_id,
      study_path: "Browser session; export after plan approval",
      state: record.state,
      browser_launch_enabled: false
    };
  }

  function createStudy(payload) {
    [
      "name", "filename", "structure", "chromophore_label",
      "property_target", "redox_state", "profile"
    ].forEach(function (key) {
      if (!String(payload[key] || "").trim()) {
        throw new Error("Missing required field: " + key + ".");
      }
    });
    if (!propertyWeights[payload.property_target]) {
      throw new Error("Unsupported property target.");
    }
    var parsed = analyzeStructure(payload.structure, payload.filename);
    var selected = parsed.residues.find(function (residue) {
      return residue.label === payload.chromophore_label;
    });
    if (!selected) {
      throw new Error("The selected chromophore is not present in the uploaded structure.");
    }
    var studyId = randomId();
    var state = {
      schema_version: 1,
      study_id: studyId,
      name: String(payload.name),
      revision: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      stage: "intake",
      user_inputs: {
        profile: String(payload.profile),
        config: "browser-generated universal study overlay",
        pdb: safeFilename(payload.filename),
        property_target: String(payload.property_target),
        redox_state: String(payload.redox_state),
        chromophore_resname: selected.name,
        chromophore_chain: selected.chain,
        chromophore_number: selected.number + selected.insertion,
        reacting_residues: Array.from(new Set(payload.reacting_residues || [])),
        run_dir: null,
        inner_cutoff_angstrom: Number(payload.inner_cutoff),
        outer_cutoff_angstrom: Number(payload.outer_cutoff)
      },
      protected_decisions: {
        redox_state: {
          value: String(payload.redox_state),
          source: "user",
          locked: true
        },
        qm_region: {
          status: "pending",
          source: "user-approval-required"
        }
      },
      approvals: {
        qm_region: { approved: false },
        run_plan: { approved: false },
        launch: { approved: false }
      },
      specialist_reports: {},
      lead: {},
      structure_analysis: parsed.analysis,
      protocol: {
        name: "Universal QM/MM protocol",
        version: 1,
        source: "platform",
        qm_charge_status: "pending-user-approval"
      },
      audit_log: [{
        timestamp: new Date().toISOString(),
        actor: "lead-agent",
        action: "study-created",
        detail: "Created in the public browser from explicit user inputs."
      }]
    };
    var record = {
      state: state,
      residues: parsed.residues
    };
    refreshStudy(record);
    studies.set(studyId, record);
    return studyResponse(record);
  }

  function mutateStudy(studyId, action, payload) {
    var record = studies.get(studyId);
    if (!record) {
      throw new Error("This browser study is no longer available.");
    }
    var state = record.state;
    if (action === "reaction") {
      var residues = Array.from(new Set(payload.residues || []));
      if (!residues.length) {
        throw new Error("Enter at least one reacting residue as CHAIN:NUMBER.");
      }
      state.user_inputs.reacting_residues = residues;
      state.approvals.qm_region = { approved: false };
      state.approvals.run_plan = { approved: false };
      state.protected_decisions.qm_region = {
        status: "pending",
        source: "user-approval-required"
      };
      refreshStudy(record);
    } else if (action === "approve-region") {
      var regionReport = state.specialist_reports["qm-region-specialist-agent"];
      var selected = Array.from(new Set(payload.selected_residues || []));
      if (state.user_inputs.property_target === "mechanism" && payload.baseline_only) {
        throw new Error("Mechanistic studies require explicit reacting residues.");
      }
      if (payload.baseline_only && selected.length) {
        throw new Error("Chromophore-only cannot be combined with selected residues.");
      }
      if (!payload.baseline_only && !selected.length) {
        throw new Error("Select at least one residue or approve chromophore-only.");
      }
      var missing = state.user_inputs.reacting_residues.filter(function (selector) {
        return !selected.includes(selector);
      });
      if (missing.length) {
        throw new Error(
          "The approved region omits user-defined reacting residues: " + missing.join(", ") + "."
        );
      }
      if (Number(payload.spin_multiplicity) < 1) {
        throw new Error("Spin multiplicity must be a positive integer.");
      }
      var decision = {
        chromophore: regionReport.payload.observation.chromophore,
        selected_residues: selected,
        baseline_only: Boolean(payload.baseline_only),
        qm_charge: Number(payload.qm_charge),
        spin_multiplicity: Number(payload.spin_multiplicity),
        representation: String(payload.representation),
        source: "user"
      };
      state.approvals.qm_region = {
        approved: true,
        approved_by: "user",
        proposal_hash: regionReport.report_hash,
        decision: decision,
        decision_hash: hashValue(decision)
      };
      state.protected_decisions.qm_region = {
        status: "approved",
        source: "user",
        decision: decision,
        locked: true
      };
      state.protocol.qm_charge = decision.qm_charge;
      state.protocol.qm_charge_status = "user-approved";
      state.approvals.run_plan = { approved: false };
      refreshStudy(record);
    } else if (action === "approve-plan") {
      var planner = state.specialist_reports["workflow-planning-agent"];
      if (!planner || state.stage !== "run-plan-review") {
        throw new Error("No valid run plan is awaiting approval.");
      }
      state.approvals.run_plan = {
        approved: true,
        approved_by: "user",
        plan_hash: planner.payload.plan_hash
      };
      refreshStudy(record);
    }
    state.revision += 1;
    state.updated_at = new Date().toISOString();
    return studyResponse(record);
  }

  var bootstrap = {
    platform_version: "0.3.1",
    profiles: [
      {
        name: "expanse",
        description: "SDSC Expanse planning profile; submission requires the authenticated gateway.",
        executor: "slurm"
      },
      {
        name: "local",
        description: "Single-host development profile with no scheduler submission.",
        executor: "local"
      },
      {
        name: "slurm-generic",
        description: "Template for a Slurm-based HPC or cloud cluster.",
        executor: "slurm"
      }
    ],
    protocol: {
      name: "Universal QM/MM protocol",
      version: 1,
      selection_required: false,
      study_overlay_generated: true
    },
    properties: Object.keys(propertyWeights),
    redox_states: [
      { value: "1", label: "Quinone (oxidized)" },
      { value: "2", label: "Semiquinone" },
      { value: "3", label: "Hydroquinone" },
      { value: "4", label: "Anionic quinone" },
      { value: "5", label: "Anionic semiquinone" },
      { value: "6", label: "Anionic hydroquinone" },
      { value: "custom", label: "Custom user-defined state" }
    ],
    policy: {
      redox_state_source: "user",
      qm_region_requires_approval: true,
      browser_launch_enabled: false
    }
  };

  async function handleApi(path, options) {
    var method = String((options && options.method) || "GET").toUpperCase();
    if (method === "GET" && path === "/api/bootstrap") {
      return bootstrap;
    }
    if (method === "GET" && path.startsWith("/api/pdb/")) {
      var pdbId = decodeURIComponent(path.slice("/api/pdb/".length)).trim().toUpperCase();
      if (!/^[A-Z0-9]{4}$/.test(pdbId)) {
        throw new Error("PDB ID must contain exactly four letters or numbers.");
      }
      var pdbResponse = await nativeFetch(
        "https://files.rcsb.org/download/" + encodeURIComponent(pdbId) + ".pdb"
      );
      if (!pdbResponse.ok) {
        throw new Error("RCSB did not return a PDB file for " + pdbId + ".");
      }
      var structure = await pdbResponse.text();
      var parsed = analyzeStructure(structure, pdbId.toLowerCase() + ".pdb");
      return { pdb_id: pdbId, structure: structure, analysis: parsed.analysis };
    }
    if (method === "POST" && path === "/api/structures/analyze") {
      var analysisPayload = requestBody(options);
      return analyzeStructure(
        analysisPayload.structure,
        analysisPayload.filename || "structure.pdb"
      ).analysis;
    }
    if (method === "POST" && path === "/api/studies") {
      return createStudy(requestBody(options));
    }
    var actionMatch = path.match(
      /^\/api\/studies\/([^/]+)\/(reaction|approve-region|approve-plan)$/
    );
    if (method === "POST" && actionMatch) {
      return mutateStudy(
        decodeURIComponent(actionMatch[1]),
        actionMatch[2],
        requestBody(options)
      );
    }
    var studyMatch = path.match(/^\/api\/studies\/([^/]+)$/);
    if (method === "GET" && studyMatch) {
      var record = studies.get(decodeURIComponent(studyMatch[1]));
      if (!record) throw new Error("This browser study is no longer available.");
      return studyResponse(record);
    }
    throw new Error("Unsupported browser API request.");
  }

  window.fetch = async function (input, options) {
    var raw = typeof input === "string" ? input : input.url;
    var url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) {
      return nativeFetch(input, options);
    }
    try {
      return jsonResponse(await handleApi(url.pathname, options), 200);
    } catch (error) {
      return jsonResponse({ error: error.message || String(error) }, 400);
    }
  };
}());
