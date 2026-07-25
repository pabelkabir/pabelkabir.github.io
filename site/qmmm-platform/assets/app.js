(function () {
  "use strict";

  var appState = {
    bootstrap: null,
    structure: "",
    filename: "",
    analysis: null,
    confirmedChromophore: null,
    study: null,
    stage3d: null,
    component3d: null,
    spinning: false,
    toastTimer: null
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function setHidden(id, hidden) {
    byId(id).hidden = hidden;
  }

  function showToast(message, isError) {
    var toast = byId("toast");
    toast.textContent = message;
    toast.classList.toggle("is-error", Boolean(isError));
    toast.hidden = false;
    window.clearTimeout(appState.toastTimer);
    appState.toastTimer = window.setTimeout(function () {
      toast.hidden = true;
    }, 4200);
  }

  async function api(path, options) {
    var request = options || {};
    request.headers = Object.assign(
      { "Content-Type": "application/json" },
      request.headers || {}
    );
    var response = await window.fetch(path, request);
    var payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error("The local platform returned an unreadable response.");
    }
    if (!response.ok) {
      throw new Error(payload.error || "The request could not be completed.");
    }
    return payload;
  }

  function setButtonBusy(button, busy, busyText) {
    if (!button.dataset.label) {
      button.dataset.label = button.innerHTML;
    }
    button.disabled = busy;
    button.innerHTML = busy
      ? '<span class="spinner" aria-hidden="true"></span>' + busyText
      : button.dataset.label;
    if (!busy && window.lucide) {
      window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
    }
  }

  function parseResidueList(value) {
    return Array.from(
      new Set(
        String(value || "")
          .split(/[\s,;]+/)
          .map(function (item) { return item.trim(); })
          .filter(Boolean)
      )
    );
  }

  function formatAgentName(value) {
    return value
      .replace(/-agent$/, "")
      .split("-")
      .map(function (part) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" ");
  }

  function initializeViewer() {
    if (!window.NGL) {
      byId("viewerEmpty").querySelector("strong").textContent =
        "Molecular renderer unavailable";
      return;
    }
    appState.stage3d = new window.NGL.Stage("moleculeViewport", {
      backgroundColor: "#f9fbfb",
      tooltip: true,
      quality: "medium"
    });
    window.addEventListener("resize", function () {
      appState.stage3d.handleResize();
    });
  }

  function proteinRepresentation() {
    return byId("representation").value;
  }

  function cofactorSelection(cofactor) {
    if (!cofactor) {
      return "";
    }
    return (
      ":" + cofactor.chain +
      " and " + cofactor.number +
      " and [" + cofactor.component_id + "]"
    );
  }

  function residueSelection(selector) {
    var parts = selector.split(":");
    return parts.length === 2 ? ":" + parts[0] + " and " + parts[1] : "";
  }

  function rebuildRepresentations() {
    var component = appState.component3d;
    if (!component) {
      return;
    }
    component.removeAllRepresentations();
    var representation = proteinRepresentation();
    var options = { sele: "polymer", colorScheme: "chainname", quality: "medium" };
    if (representation === "surface") {
      options.opacity = 0.72;
      options.surfaceType = "av";
    }
    component.addRepresentation(representation, options);
    component.addRepresentation("ball+stick", {
      sele: "hetero and not water",
      colorScheme: "element",
      multipleBond: true
    });

    var selectedCofactor = currentChromophore();
    if (selectedCofactor) {
      component.addRepresentation("ball+stick", {
        sele: cofactorSelection(selectedCofactor),
        color: "#d46431",
        scale: 2.1,
        multipleBond: true
      });
    }

    selectedCandidateSelectors().forEach(function (selector) {
      component.addRepresentation("licorice", {
        sele: residueSelection(selector),
        color: "#176c70",
        scale: 1.35
      });
    });
  }

  async function loadStructureInViewer(structure) {
    if (!appState.stage3d) {
      return;
    }
    setHidden("viewerLoading", false);
    byId("viewerEmpty").hidden = true;
    appState.stage3d.removeAllComponents();
    appState.component3d = null;
    try {
      var blob = new window.Blob([structure], { type: "text/plain" });
      appState.component3d = await appState.stage3d.loadFile(blob, { ext: "pdb" });
      rebuildRepresentations();
      appState.component3d.autoView();
    } catch (error) {
      byId("viewerEmpty").hidden = false;
      byId("viewerEmpty").querySelector("strong").textContent =
        "The structure could not be rendered";
      showToast("Structure analysis succeeded, but the 3D view failed.", true);
    } finally {
      setHidden("viewerLoading", true);
    }
  }

  function currentChromophore() {
    if (!appState.analysis) {
      return null;
    }
    var selectedLabel = byId("chromophoreSelect").value;
    return appState.analysis.ligands.find(function (ligand) {
      return ligand.label === selectedLabel;
    }) || null;
  }

  function selectedCandidateSelectors() {
    return Array.from(
      document.querySelectorAll(".candidate-select:checked")
    ).map(function (checkbox) {
      return checkbox.dataset.selector;
    });
  }

  function updateDetectionPreview() {
    var selected = currentChromophore();
    appState.confirmedChromophore = null;
    byId("decisionChromophore").textContent = selected
      ? selected.label + " (confirmation required)"
      : "Not selected";
    byId("confirmChromophoreButton").disabled = !selected;
    updateStudyButton();
    rebuildRepresentations();
  }

  function renderStructureAnalysis(analysis) {
    appState.analysis = analysis;
    appState.confirmedChromophore = null;
    byId("structureMeta").textContent =
      analysis.filename + " \u00b7 " + analysis.chain_count + " chain" +
      (analysis.chain_count === 1 ? "" : "s");
    byId("atomCount").textContent = analysis.atom_count.toLocaleString();
    byId("residueCount").textContent = analysis.residue_count.toLocaleString();
    byId("chainCount").textContent = analysis.chain_count.toLocaleString();
    setHidden("structureSummary", false);

    var banner = byId("detectionBanner");
    var select = byId("chromophoreSelect");
    var options = analysis.detected_flavins.length
      ? analysis.detected_flavins
      : analysis.ligands;
    select.replaceChildren();
    options.forEach(function (cofactor) {
      var option = document.createElement("option");
      option.value = cofactor.label;
      option.textContent =
        cofactor.component_id + " \u00b7 chain " + cofactor.chain +
        " \u00b7 residue " + cofactor.number +
        " \u00b7 " + cofactor.resolved_atom_count + " atoms";
      select.appendChild(option);
    });

    banner.classList.toggle("no-match", analysis.detected_flavins.length === 0);
    if (analysis.detected_flavins.length === 1) {
      var match = analysis.detected_flavins[0];
      byId("detectionTitle").textContent =
        match.component_id + " detected";
      byId("detectionDetail").textContent =
        match.component_name + ", chain " + match.chain +
        ", residue " + match.number +
        ". Confirm before scientific setup.";
    } else if (analysis.detected_flavins.length > 1) {
      byId("detectionTitle").textContent =
        analysis.detected_flavins.length + " flavin cofactors detected";
      byId("detectionDetail").textContent =
        "Choose the biologically relevant FMN or FAD copy.";
    } else {
      byId("detectionTitle").textContent = "No exact FMN/FAD match";
      byId("detectionDetail").textContent = options.length
        ? "Select another resolved ligand or inspect the structure preparation."
        : "No non-protein ligand is available for selection.";
    }
    banner.hidden = false;
    byId("confirmChromophoreButton").disabled = options.length === 0;
    byId("decisionChromophore").textContent = options.length
      ? "Confirmation required"
      : "No ligand detected";
    updateWorkflow("structure");
    updateStudyButton();
    updateProtocolStatus();
  }

  async function applyStructure(structure, filename, analysis) {
    appState.structure = structure;
    appState.filename = filename;
    appState.study = null;
    setHidden("regionWorkspace", true);
    setHidden("planWorkspace", true);
    renderStructureAnalysis(analysis);
    await loadStructureInViewer(structure);
  }

  async function analyzeLocalFile(file) {
    var button = document.querySelector(".file-button");
    button.classList.add("is-busy");
    try {
      var structure = await file.text();
      var analysis = await api("/api/structures/analyze", {
        method: "POST",
        body: JSON.stringify({ structure: structure, filename: file.name })
      });
      await applyStructure(structure, file.name, analysis);
      byId("studyName").value =
        file.name.replace(/\.pdb$/i, "") + "-absorption";
      showToast("Structure loaded. Review the detected cofactor.");
    } catch (error) {
      showToast(error.message, true);
    } finally {
      button.classList.remove("is-busy");
      byId("structureFile").value = "";
    }
  }

  async function loadPdb() {
    var button = byId("loadPdbButton");
    var pdbId = byId("pdbId").value.trim();
    if (!pdbId) {
      showToast("Enter a four-character PDB ID.", true);
      return;
    }
    setButtonBusy(button, true, "Loading");
    try {
      var response = await api("/api/pdb/" + encodeURIComponent(pdbId));
      await applyStructure(
        response.structure,
        response.analysis.filename,
        response.analysis
      );
      byId("studyName").value =
        response.pdb_id.toLowerCase() + "-absorption";
      showToast(response.analysis.detection_message);
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setButtonBusy(button, false);
    }
  }

  function confirmChromophore() {
    var selected = currentChromophore();
    if (!selected) {
      showToast("Select a chromophore candidate.", true);
      return;
    }
    appState.confirmedChromophore = selected;
    byId("decisionChromophore").textContent = selected.label + " \u00b7 confirmed";
    byId("setupState").textContent = "Ready for user input";
    updateWorkflow("science");
    updateStudyButton();
    updateProtocolStatus();
    rebuildRepresentations();
    byId("setupWorkspace").scrollIntoView({ behavior: "smooth", block: "start" });
    showToast(selected.component_id + " confirmed as the chromophore.");
  }

  function populateBootstrap(payload) {
    appState.bootstrap = payload;
    byId("environmentBadge").textContent =
      "Platform " + payload.platform_version + " \u00b7 public designer";
    byId("connectionStatus").classList.add("is-connected");
    byId("connectionStatus").lastChild.textContent = " Ready";

    var redoxSelect = byId("redoxState");
    payload.redox_states.forEach(function (state) {
      var option = document.createElement("option");
      option.value = state.value;
      option.textContent = state.label;
      redoxSelect.appendChild(option);
    });

    var profileSelect = byId("profile");
    payload.profiles.forEach(function (profile) {
      var option = document.createElement("option");
      option.value = profile.name;
      option.textContent = profile.name + " \u00b7 " + profile.executor;
      option.selected = profile.name === "expanse";
      profileSelect.appendChild(option);
    });

    byId("protocolName").textContent = payload.protocol.name;
    byId("protocolVersion").textContent =
      "Version " + payload.protocol.version + " \u00b7 generated per study";
    updateStudyButton();
  }

  function selectedRedoxState() {
    return byId("redoxState").value === "custom"
      ? byId("customRedoxState").value.trim()
      : byId("redoxState").value;
  }

  function updatePropertyFields() {
    var property = byId("propertyTarget").value;
    var needsReaction = property === "mechanism";
    setHidden("reactionField", !needsReaction);
    var studyName = byId("studyName");
    if (appState.filename && !appState.study) {
      studyName.value =
        appState.filename.replace(/\.pdb$/i, "") + "-" + property;
    }
    updateStudyButton();
  }

  function updateRedoxFields() {
    var isCustom = byId("redoxState").value === "custom";
    setHidden("customRedoxField", !isCustom);
    byId("decisionRedox").textContent = selectedRedoxState()
      ? selectedRedoxState() + " \u00b7 user supplied"
      : "User input required";
    updateProtocolStatus();
    updateStudyButton();
  }

  function updateProtocolStatus() {
    var message = byId("protocolStatus");
    var redox = selectedRedoxState();
    var cofactor = appState.confirmedChromophore;
    if (redox && cofactor && byId("profile").value) {
      message.textContent =
        "Universal protocol will record " + cofactor.component_id +
        ", redox " + redox + ", and " + byId("profile").value + " deployment.";
      message.style.color = "#2f7555";
    } else {
      message.textContent = "Exact settings will be recorded with the study.";
      message.style.color = "";
    }
  }

  function updateStudyButton() {
    var hasCustomRedox =
      byId("redoxState").value !== "custom" ||
      Boolean(byId("customRedoxState").value.trim());
    byId("createStudyButton").disabled = !(
      appState.structure &&
      appState.confirmedChromophore &&
      selectedRedoxState() &&
      hasCustomRedox &&
      byId("profile").value &&
      byId("studyName").value.trim()
    );
  }

  async function createStudy(event) {
    event.preventDefault();
    if (!appState.confirmedChromophore) {
      showToast("Confirm the chromophore before creating the study.", true);
      return;
    }
    var button = byId("createStudyButton");
    var payload = {
      name: byId("studyName").value.trim(),
      filename: appState.filename,
      structure: appState.structure,
      chromophore_label: appState.confirmedChromophore.label,
      property_target: byId("propertyTarget").value,
      redox_state: selectedRedoxState(),
      profile: byId("profile").value,
      reacting_residues: parseResidueList(byId("reactingResidues").value),
      inner_cutoff: Number(byId("innerCutoff").value),
      outer_cutoff: Number(byId("outerCutoff").value)
    };
    setButtonBusy(button, true, "Creating");
    try {
      appState.study = await api("/api/studies", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      renderStudy(appState.study);
      showToast("Study created. The lead agent has reviewed the inputs.");
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setButtonBusy(button, false);
      updateStudyButton();
    }
  }

  function workflowStageForState(stage) {
    if (["reaction-definition", "qm-region-review"].includes(stage)) {
      return "qm-region";
    }
    if (["run-plan-review", "implementation-blocked", "ready-for-launch"].includes(stage)) {
      return "run-plan";
    }
    if (["monitoring", "results-review"].includes(stage)) {
      return "results";
    }
    return "science";
  }

  function updateWorkflow(stage) {
    var order = ["structure", "science", "qm-region", "run-plan", "results"];
    var active = order.indexOf(stage);
    document.querySelectorAll(".workflow-nav li").forEach(function (item) {
      var index = order.indexOf(item.dataset.stage);
      item.classList.toggle("is-current", index === active);
      item.classList.toggle("is-complete", index < active);
    });
  }

  function renderLead(state) {
    var leadMessage = byId("leadMessage");
    leadMessage.classList.toggle("is-error", state.stage === "blocked");
    leadMessage.replaceChildren();
    var paragraph = document.createElement("p");
    paragraph.textContent = state.lead.message;
    leadMessage.appendChild(paragraph);

    var questions = state.lead.questions || [];
    setHidden("leadQuestions", questions.length === 0);
    var questionList = byId("leadQuestionList");
    questionList.replaceChildren();
    questions.forEach(function (question) {
      var item = document.createElement("li");
      item.textContent = question;
      questionList.appendChild(item);
    });

    byId("decisionRedox").textContent =
      state.protected_decisions.redox_state.value + " \u00b7 user supplied";
    var region = state.protected_decisions.qm_region;
    byId("decisionRegion").textContent =
      region.status === "approved"
        ? "Approved \u00b7 locked"
        : "User approval required";

    var reports = state.specialist_reports || {};
    var specialistList = byId("specialistList");
    specialistList.replaceChildren();
    Object.keys(reports).forEach(function (name) {
      var item = document.createElement("li");
      var label = document.createElement("span");
      label.textContent = formatAgentName(name);
      var status = document.createElement("span");
      status.className = "status-pill " + reports[name].status;
      status.textContent = reports[name].status.replace(/-/g, " ");
      item.append(label, status);
      specialistList.appendChild(item);
    });
    setHidden("specialistStatus", Object.keys(reports).length === 0);
  }

  function candidateCheckboxes() {
    return Array.from(document.querySelectorAll(".candidate-select"));
  }

  function renderCandidates(report, state) {
    var tableBody = byId("candidateTableBody");
    tableBody.replaceChildren();
    var property = state.user_inputs.property_target;
    var isBaselineProperty = ["absorption", "fluorescence"].includes(property);
    var isMechanism = property === "mechanism";
    byId("baselineOnly").checked = isBaselineProperty;
    byId("baselineOnly").disabled = isMechanism;

    report.proposal.candidates_for_review.forEach(function (candidate) {
      var row = document.createElement("tr");
      var includeCell = document.createElement("td");
      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "candidate-select";
      checkbox.dataset.selector = candidate.selector;
      checkbox.dataset.atoms = String(candidate.estimated_added_heavy_atoms);
      checkbox.checked =
        candidate.required_by_user ||
        (!isBaselineProperty &&
          candidate.recommendation === "strong-candidate-for-user-review");
      checkbox.disabled = byId("baselineOnly").checked;
      checkbox.setAttribute("aria-label", "Include " + candidate.residue);
      includeCell.appendChild(checkbox);

      var residueCell = document.createElement("td");
      var residueName = document.createElement("span");
      residueName.className = "residue-name";
      residueName.textContent = candidate.residue;
      var tag = document.createElement("span");
      tag.className = "residue-tag" + (candidate.required_by_user ? " required" : "");
      tag.textContent = candidate.required_by_user
        ? "User required"
        : candidate.recommendation.replace(/-/g, " ");
      residueCell.append(residueName, tag);

      var distanceCell = document.createElement("td");
      distanceCell.textContent =
        Number(candidate.minimum_distance_angstrom).toFixed(2) + " \u00c5";

      var scoreCell = document.createElement("td");
      scoreCell.append(document.createTextNode(String(candidate.score)));
      var meter = document.createElement("div");
      meter.className = "score-meter";
      var meterFill = document.createElement("span");
      meterFill.style.width = Math.min(100, Number(candidate.score)) + "%";
      meter.appendChild(meterFill);
      scoreCell.appendChild(meter);

      var evidenceCell = document.createElement("td");
      evidenceCell.className = "candidate-evidence";
      evidenceCell.textContent = candidate.evidence.slice(0, 2).join(" ");

      var atomCell = document.createElement("td");
      atomCell.textContent = String(candidate.estimated_added_heavy_atoms);
      row.append(
        includeCell,
        residueCell,
        distanceCell,
        scoreCell,
        evidenceCell,
        atomCell
      );
      tableBody.appendChild(row);

      checkbox.addEventListener("change", function () {
        if (checkbox.checked) {
          byId("baselineOnly").checked = false;
          candidateCheckboxes().forEach(function (item) {
            item.disabled = false;
          });
        }
        updateRegionSelection();
      });
    });
    updateRegionSelection();
  }

  function updateRegionSelection() {
    var selected = candidateCheckboxes().filter(function (checkbox) {
      return checkbox.checked;
    });
    var totalAtoms = selected.reduce(function (total, checkbox) {
      return total + Number(checkbox.dataset.atoms || 0);
    }, 0);
    byId("regionTotal").textContent =
      totalAtoms + " additional heavy atom" + (totalAtoms === 1 ? "" : "s");
    candidateCheckboxes().forEach(function (checkbox) {
      var row = checkbox.closest("tr");
      row.classList.toggle("is-selected", checkbox.checked);
    });
    rebuildRepresentations();
  }

  function renderRegion(state) {
    var reportContainer =
      state.specialist_reports["qm-region-specialist-agent"];
    if (!reportContainer) {
      setHidden("regionWorkspace", true);
      return;
    }
    setHidden("regionWorkspace", false);
    var approved = Boolean(state.approvals.qm_region.approved);
    var regionState = byId("regionWorkspace").querySelector(".section-state");
    regionState.textContent = approved ? "Approved \u00b7 locked" : "User approval required";
    regionState.classList.toggle("needs-review", !approved);
    regionState.classList.toggle("is-approved", approved);
    var needsReaction = state.stage === "reaction-definition";
    setHidden("reactionDefinition", !needsReaction);
    setHidden("regionReview", needsReaction);
    if (needsReaction) {
      byId("reactionUpdateInput").value =
        (state.user_inputs.reacting_residues || []).join(", ");
      return;
    }
    var report = reportContainer.payload;
    if (report && report.proposal) {
      renderCandidates(report, state);
    }
    byId("baselineOnly").disabled =
      approved || state.user_inputs.property_target === "mechanism";
    candidateCheckboxes().forEach(function (checkbox) {
      checkbox.disabled = approved || byId("baselineOnly").checked;
    });
    byId("qmCharge").disabled = approved;
    byId("spinMultiplicity").disabled = approved;
    byId("boundaryRepresentation").disabled = approved;
    byId("approveRegionButton").disabled = approved;
  }

  function appendPlanItem(container, label, value) {
    var list = document.createElement("dl");
    var term = document.createElement("dt");
    var definition = document.createElement("dd");
    term.textContent = label;
    definition.textContent = value;
    list.append(term, definition);
    container.appendChild(list);
  }

  function renderPlan(state) {
    var planner = state.specialist_reports["workflow-planning-agent"];
    if (!planner || !planner.payload || !planner.payload.plan) {
      setHidden("planWorkspace", true);
      return;
    }
    var plan = planner.payload.plan;
    var summary = byId("planSummary");
    summary.replaceChildren();
    appendPlanItem(summary, "Project", plan.project || state.name);
    appendPlanItem(
      summary,
      "Compute",
      plan.resources.gpus + " GPU \u00b7 " + plan.resources.cpus + " CPU"
    );
    appendPlanItem(summary, "Walltime", plan.resources.walltime);
    appendPlanItem(summary, "Run directory", plan.run_dir);
    setHidden("planWorkspace", false);
    var approved = Boolean(state.approvals.run_plan.approved);
    var planState = byId("planWorkspace").querySelector(".section-state");
    planState.textContent = approved ? "Approved \u00b7 export ready" : "User approval required";
    planState.classList.toggle("needs-review", !approved);
    planState.classList.toggle("is-approved", approved);
    byId("approvePlanButton").disabled = state.stage !== "run-plan-review";
    byId("downloadPlanButton").hidden = !approved;
  }

  function downloadStudyPlan() {
    if (!appState.study) {
      showToast("Create and approve a study before exporting it.", true);
      return;
    }
    var state = appState.study.state;
    var payload = {
      exported_at: new Date().toISOString(),
      platform: "Kabir Lab QM/MM Platform",
      platform_version: appState.bootstrap.platform_version,
      browser_submission_enabled: false,
      state: state
    };
    var blob = new Blob(
      [JSON.stringify(payload, null, 2) + "\n"],
      { type: "application/json" }
    );
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = state.name.replace(/[^a-z0-9._-]+/gi, "-") + "-study.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Study JSON exported. No job was submitted.");
  }

  function renderStudy(response) {
    appState.study = response;
    var state = response.state;
    updateWorkflow(workflowStageForState(state.stage));
    renderLead(state);
    renderRegion(state);
    renderPlan(state);
    byId("studyPath").textContent = response.study_path;
    setHidden("studyRecord", false);
    byId("setupState").textContent = "Study recorded";

    if (["reaction-definition", "qm-region-review"].includes(state.stage)) {
      byId("regionWorkspace").scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (state.stage === "run-plan-review") {
      byId("planWorkspace").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function setReaction() {
    var residues = parseResidueList(byId("reactionUpdateInput").value);
    if (!residues.length) {
      showToast("Enter at least one reacting residue as CHAIN:NUMBER.", true);
      return;
    }
    var button = byId("setReactionButton");
    setButtonBusy(button, true, "Updating");
    try {
      var response = await api(
        "/api/studies/" + appState.study.study_id + "/reaction",
        {
          method: "POST",
          body: JSON.stringify({ residues: residues })
        }
      );
      renderStudy(response);
      showToast("Reaction definition recorded and QM-region candidates updated.");
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setButtonBusy(button, false);
    }
  }

  async function approveRegion() {
    var button = byId("approveRegionButton");
    var payload = {
      selected_residues: selectedCandidateSelectors(),
      baseline_only: byId("baselineOnly").checked,
      qm_charge: Number(byId("qmCharge").value),
      spin_multiplicity: Number(byId("spinMultiplicity").value),
      representation: byId("boundaryRepresentation").value
    };
    setButtonBusy(button, true, "Approving");
    try {
      var response = await api(
        "/api/studies/" + appState.study.study_id + "/approve-region",
        {
          method: "POST",
          body: JSON.stringify(payload)
        }
      );
      renderStudy(response);
      showToast("QM region approved and locked to the current proposal.");
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setButtonBusy(button, false);
      button.disabled = Boolean(
        appState.study && appState.study.state.approvals.qm_region.approved
      );
    }
  }

  async function approvePlan() {
    var button = byId("approvePlanButton");
    setButtonBusy(button, true, "Approving");
    try {
      var response = await api(
        "/api/studies/" + appState.study.study_id + "/approve-plan",
        { method: "POST", body: "{}" }
      );
      renderStudy(response);
      showToast("Run plan approved. No job was submitted.");
    } catch (error) {
      showToast(error.message, true);
    } finally {
      setButtonBusy(button, false);
      button.disabled = Boolean(
        appState.study && appState.study.state.stage !== "run-plan-review"
      );
    }
  }

  function handleBaselineToggle() {
    var baseline = byId("baselineOnly").checked;
    candidateCheckboxes().forEach(function (checkbox) {
      if (baseline) {
        checkbox.checked = false;
      }
      checkbox.disabled = baseline;
    });
    updateRegionSelection();
  }

  function bindEvents() {
    byId("structureFile").addEventListener("change", function (event) {
      var file = event.target.files[0];
      if (file) {
        analyzeLocalFile(file);
      }
    });
    byId("loadPdbButton").addEventListener("click", loadPdb);
    byId("pdbId").addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        loadPdb();
      }
    });
    byId("chromophoreSelect").addEventListener("change", updateDetectionPreview);
    byId("confirmChromophoreButton").addEventListener("click", confirmChromophore);
    byId("representation").addEventListener("change", rebuildRepresentations);
    byId("focusButton").addEventListener("click", function () {
      if (appState.component3d) {
        appState.component3d.autoView();
      }
    });
    byId("spinButton").addEventListener("click", function () {
      appState.spinning = !appState.spinning;
      byId("spinButton").setAttribute("aria-pressed", String(appState.spinning));
      if (appState.stage3d) {
        appState.stage3d.setSpin([0, 1, 0], appState.spinning ? 0.01 : 0);
      }
    });
    byId("propertyTarget").addEventListener("change", updatePropertyFields);
    byId("redoxState").addEventListener("change", updateRedoxFields);
    byId("customRedoxState").addEventListener("input", updateRedoxFields);
    byId("profile").addEventListener("change", updateProtocolStatus);
    byId("studyName").addEventListener("input", updateStudyButton);
    byId("studyForm").addEventListener("submit", createStudy);
    byId("baselineOnly").addEventListener("change", handleBaselineToggle);
    byId("setReactionButton").addEventListener("click", setReaction);
    byId("approveRegionButton").addEventListener("click", approveRegion);
    byId("approvePlanButton").addEventListener("click", approvePlan);
    byId("downloadPlanButton").addEventListener("click", downloadStudyPlan);
  }

  async function initialize() {
    if (window.lucide) {
      window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
    }
    initializeViewer();
    bindEvents();
    try {
      var bootstrap = await api("/api/bootstrap");
      populateBootstrap(bootstrap);
    } catch (error) {
      byId("connectionStatus").lastChild.textContent = " Unavailable";
      byId("leadMessage").classList.add("is-error");
      byId("leadMessage").querySelector("p").textContent = error.message;
      showToast(error.message, true);
    }
  }

  document.addEventListener("DOMContentLoaded", initialize);
}());
