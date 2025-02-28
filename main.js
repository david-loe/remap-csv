document.addEventListener("DOMContentLoaded", function () {
  let csvData = "";
  let defaultMappings = {};
  let headers = [];

  const csvFileInput = document.getElementById("csvFileInput");
  const mappingSection = document.getElementById("mappingSection");
  const mappingTableBody = document.getElementById("mappingTable").querySelector("tbody");
  const processBtn = document.getElementById("processBtn");
  const downloadLink = document.getElementById("downloadLink");
  const mappingSelectSection = document.getElementById("mappingSelectSection");
  const mappingSelect = document.getElementById("mappingSelect");
  const addColumnBtn = document.getElementById("addColumnBtn");
  const saveMappingBtn = document.getElementById("saveMappingBtn");
  const loadMappingBtn = document.getElementById("loadMappingBtn");

  // Cookie helper functions (for saving mapping persistently)
  function setCookie(cname, cvalue, exdays) {
    const d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    const expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + encodeURIComponent(cvalue) + ";" + expires + ";path=/";
  }

  function getCookie(cname) {
    const name = cname + "=";
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i].trim();
      if (c.indexOf(name) === 0) {
        return c.substring(name.length, c.length);
      }
    }
    return "";
  }

  // Load default mappings from mappings.json
  fetch("mappings.json")
    .then(response => {
      if (!response.ok) {
        throw new Error("Could not load default mappings.");
      }
      return response.json();
    })
    .then(data => {
      defaultMappings = data.mappings || {};
      // Populate the select element with mapping options
      for (let key in defaultMappings) {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = key;
        mappingSelect.appendChild(option);
      }
    })
    .catch(error => {
      console.error("Error loading default mappings:", error);
    });

  // Automatically load CSV when a file is selected
  csvFileInput.addEventListener("change", function () {
    if (csvFileInput.files.length === 0) {
      return;
    }
    const file = csvFileInput.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
      csvData = e.target.result;
      const lines = csvData.split(/\r\n|\n/);
      if (lines.length === 0 || lines[0].trim() === "") {
        alert("The CSV file appears to be empty.");
        return;
      }
      headers = lines[0].split(",");
      // Clear previous mapping rows
      mappingTableBody.innerHTML = "";
      // Create rows for each CSV header (these are read-only for the left cell)
      headers.forEach(function (header) {
        const row = document.createElement("tr");
        // Left cell: Original column (read-only)
        const cellOriginal = document.createElement("td");
        cellOriginal.textContent = header;
        row.appendChild(cellOriginal);
        // Right cell: Mapping rule (editable)
        const cellMapping = document.createElement("td");
        const inputMapping = document.createElement("input");
        inputMapping.type = "text";
        inputMapping.className = "form-control";
        // Default: keep original header as mapping rule
        inputMapping.value = header;
        cellMapping.appendChild(inputMapping);
        row.appendChild(cellMapping);
        mappingTableBody.appendChild(row);
      });
      mappingSection.style.display = "block";
      mappingSelectSection.style.display = "block";
    };
    reader.readAsText(file);
  });

  // Button to add a new column mapping row (for columns not present in the CSV)
  addColumnBtn.addEventListener("click", function () {
    const row = document.createElement("tr");
    // Left cell: Editable new column name (placeholder text)
    const cellOriginal = document.createElement("td");
    const inputOriginal = document.createElement("input");
    inputOriginal.type = "text";
    inputOriginal.className = "form-control";
    inputOriginal.placeholder = "New Column Name";
    cellOriginal.appendChild(inputOriginal);
    row.appendChild(cellOriginal);
    // Right cell: Mapping rule (editable), pre-filled with "fixed:" as hint
    const cellMapping = document.createElement("td");
    const inputMapping = document.createElement("input");
    inputMapping.type = "text";
    inputMapping.className = "form-control";
    inputMapping.value = "fixed:";  // Hint for fixed mapping
    cellMapping.appendChild(inputMapping);
    row.appendChild(cellMapping);
    // Mark row as "new" so that it is processed differently (no CSV index)
    row.dataset.new = "true";
    mappingTableBody.appendChild(row);
  });

  // Automatically apply selected mapping when dropdown changes
  mappingSelect.addEventListener("change", function () {
    const selectedMappingKey = mappingSelect.value;
    const rows = mappingTableBody.querySelectorAll("tr");
    let mapping = {};
    if (selectedMappingKey !== "custom" && defaultMappings[selectedMappingKey]) {
      mapping = defaultMappings[selectedMappingKey];
      rows.forEach(function (row) {
        // Für bestehende Zeilen: CSV-Spalte oder manuell hinzugefügte neue Spalte
        let original = row.dataset.new ? row.cells[0].querySelector("input").value : row.cells[0].textContent;
        const input = row.cells[1].querySelector("input");
        if (mapping.hasOwnProperty(original)) {
          input.value = mapping[original];
        } else {
          input.value = "";
        }
      });
      // Erfassung der bereits vorhandenen Schlüssel
      const appliedKeys = new Set();
      rows.forEach(row => {
        let original = row.dataset.new ? row.cells[0].querySelector("input").value : row.cells[0].textContent;
        appliedKeys.add(original);
      });
      // Neue Spalten aus dem Mapping hinzufügen, wenn sie noch nicht existieren
      for (let key in mapping) {
        if (!appliedKeys.has(key)) {
          const row = document.createElement("tr");
          // Linke Zelle: Neuer Spaltenname (editierbar)
          const cellOriginal = document.createElement("td");
          const inputOriginal = document.createElement("input");
          inputOriginal.type = "text";
          inputOriginal.className = "form-control";
          inputOriginal.value = key;
          cellOriginal.appendChild(inputOriginal);
          row.appendChild(cellOriginal);
          // Rechte Zelle: Mapping-Regel
          const cellMapping = document.createElement("td");
          const inputMapping = document.createElement("input");
          inputMapping.type = "text";
          inputMapping.className = "form-control";
          inputMapping.value = mapping[key];
          cellMapping.appendChild(inputMapping);
          row.appendChild(cellMapping);
          // Kennzeichne die Zeile als neue Spalte
          row.dataset.new = "true";
          mappingTableBody.appendChild(row);
        }
      }
    } else {
      // Für Custom Mapping: Zurücksetzen der Zeilen, die von der CSV stammen
      rows.forEach(function (row) {
        if (row.dataset.new) return; // Neue Spalten nicht zurücksetzen
        const original = row.cells[0].textContent;
        const input = row.cells[1].querySelector("input");
        input.value = original;
      });
    }
  });


  // Save mapping rules to cookie (with a long expiration, e.g. 10 years)
  saveMappingBtn.addEventListener("click", function () {
    const mappingArray = [];
    const rows = mappingTableBody.querySelectorAll("tr");
    rows.forEach(function (row) {
      // For new rows, get the value from the left input; for CSV rows, use cell text.
      const original = row.dataset.new ? row.cells[0].querySelector("input").value : row.cells[0].textContent;
      const rule = row.cells[1].querySelector("input").value;
      mappingArray.push({ original, rule });
    });
    // Save as JSON string in a cookie (expires in 10 years)
    setCookie("savedMapping", JSON.stringify(mappingArray), 3650);
    alert("Mapping saved!");
  });

  // Load mapping rules from cookie and apply them to the table
  loadMappingBtn.addEventListener("click", function () {
    const saved = getCookie("savedMapping");
    if (saved) {
      try {
        const mappingArray = JSON.parse(saved);
        const rows = mappingTableBody.querySelectorAll("tr");
        // For each saved rule, if the original column exists in the table, update its rule.
        mappingArray.forEach(function (item) {
          rows.forEach(function (row) {
            let original = row.dataset.new ? row.cells[0].querySelector("input").value : row.cells[0].textContent;
            if (original === item.original) {
              row.cells[1].querySelector("input").value = item.rule;
            }
          });
        });
        alert("Mapping loaded!");
      } catch (e) {
        alert("Error parsing saved mapping.");
      }
    } else {
      alert("No saved mapping found.");
    }
  });

  // Process CSV with advanced mapping logic and automatically trigger download
  processBtn.addEventListener("click", function () {
    if (csvData === "") {
      alert("No CSV data available. Please load a file first.");
      return;
    }

    // Build array of mapping rules from the table.
    // For rows that came from the CSV header, store an index;
    // for new rows, mark them as new.
    const mappingArray = [];
    const rows = mappingTableBody.querySelectorAll("tr");
    rows.forEach(function (row, idx) {
      let original;
      let isNew = false;
      if (row.dataset.new) {
        original = row.cells[0].querySelector("input").value;
        isNew = true;
      } else {
        original = row.cells[0].textContent;
      }
      const rule = row.cells[1].querySelector("input").value;
      // Only assign an index for rows that are not new.
      mappingArray.push({ original, rule, index: isNew ? null : idx, isNew });
    });

    // Build output mapping with special logic:
    // - "fixed:" prefix => fixed mapping (format: fixed:ColumnName|FixedValue)
    // - "split:" prefix => conditional split mapping (format: split:NegativeHeader|PositiveHeader)
    // - Otherwise, normal mapping.
    const outputMapping = [];
    mappingArray.forEach((item, i) => {
      let rule = item.rule.trim();
      if (rule.startsWith("split:")) {
        let parts = rule.substring(6).split("|");
        if (parts.length === 2) {
          outputMapping.push({
            type: "split",
            // For CSV rows, use the stored index; for new rows, index is undefined.
            index: item.isNew ? null : item.index,
            negativeHeader: parts[0].trim(),
            positiveHeader: parts[1].trim(),
            isNew: item.isNew
          });
        } else if (rule !== "") {
          outputMapping.push({
            type: "normal",
            index: item.isNew ? null : item.index,
            header: rule,
            isNew: item.isNew
          });
        }
      } else if (rule.startsWith("fixed:")) {
        let fixedContent = rule.substring(6).trim();
        let parts = fixedContent.split("|");
        if (parts.length === 2) {
          outputMapping.push({
            type: "fixed",
            header: parts[0].trim(),
            fixedValue: parts[1].trim(),
            isNew: item.isNew
          });
        } else if (rule !== "") {
          outputMapping.push({
            type: "fixed",
            header: item.original,
            fixedValue: fixedContent,
            isNew: item.isNew
          });
        }
      } else {
        if (rule !== "") {
          outputMapping.push({
            type: "normal",
            index: item.isNew ? null : item.index,
            header: rule,
            isNew: item.isNew
          });
        }
      }
    });

    const lines = csvData.split(/\r\n|\n/);
    if (lines.length === 0) return;

    // Build new header row from outputMapping
    const newHeaders = [];
    outputMapping.forEach(mapping => {
      if (mapping.type === "normal" || mapping.type === "fixed") {
        newHeaders.push(mapping.header);
      } else if (mapping.type === "split") {
        newHeaders.push(mapping.negativeHeader);
        newHeaders.push(mapping.positiveHeader);
      }
    });
    let newCsvContent = newHeaders.join(",") + "\n";

    // Process each CSV row (excluding header)
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() !== "") {
        const rowValues = lines[i].split(",");
        const newRow = [];
        outputMapping.forEach(mapping => {
          if (mapping.type === "normal") {
            // For new rows, no CSV value exists – output an empty string.
            newRow.push(mapping.index !== null ? (rowValues[mapping.index] || "") : "");
          } else if (mapping.type === "fixed") {
            newRow.push(mapping.fixedValue);
          } else if (mapping.type === "split") {
            if (mapping.index !== null) {
              const val = rowValues[mapping.index] || "";
              const num = parseFloat(val);
              if (!isNaN(num)) {
                if (num < 0) {
                  newRow.push(Math.abs(num));
                  newRow.push("");
                } else if (num > 0) {
                  newRow.push("");
                  newRow.push(num);
                } else {
                  newRow.push("");
                  newRow.push("");
                }
              } else {
                newRow.push("");
                newRow.push("");
              }
            } else {
              // For new rows with a split mapping, no CSV value exists.
              newRow.push("");
              newRow.push("");
            }
          }
        });
        newCsvContent += newRow.join(",") + "\n";
      }
    }

    // Create Blob and automatically trigger download
    const blob = new Blob([newCsvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = "renamed_columns.csv";
    downloadLink.click();
  });
});
