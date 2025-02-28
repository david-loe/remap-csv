document.addEventListener("DOMContentLoaded", function () {
  let csvData = "";
  let defaultMappings = {};
  let headers = [];
  let fileName = ""; // Store original file name

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

  // --- CSV Parsing Function ---
  // This function parses a single CSV line handling quoted fields correctly.
  function parseCSVLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        // If already in quotes and next char is also a quote, it's an escaped quote.
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  // --- Cookie Helper Functions (with expiration for persistence) ---
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

  // --- Load Default Mappings from mappings.json ---
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

  // --- Automatically Load CSV When a File is Selected ---
  csvFileInput.addEventListener("change", function () {
    if (csvFileInput.files.length === 0) {
      return;
    }
    const file = csvFileInput.files[0];
    fileName = file.name; // Save original file name
    const reader = new FileReader();
    reader.onload = function (e) {
      csvData = e.target.result;
      const lines = csvData.split(/\r\n|\n/);
      if (lines.length === 0 || lines[0].trim() === "") {
        alert("The CSV file appears to be empty.");
        return;
      }
      headers = parseCSVLine(lines[0]);  // Use custom CSV parser for header
      // Clear previous mapping rows
      mappingTableBody.innerHTML = "";
      // Create rows for each CSV header
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

  // --- Add New Column Button (for columns not in CSV) ---
  addColumnBtn.addEventListener("click", function () {
    const row = document.createElement("tr");
    // Left cell: New column name (editable)
    const cellOriginal = document.createElement("td");
    const inputOriginal = document.createElement("input");
    inputOriginal.type = "text";
    inputOriginal.className = "form-control";
    inputOriginal.placeholder = "New Column Name";
    cellOriginal.appendChild(inputOriginal);
    row.appendChild(cellOriginal);
    // Right cell: Mapping rule (editable), pre-filled with "fixed:" as a hint
    const cellMapping = document.createElement("td");
    const inputMapping = document.createElement("input");
    inputMapping.type = "text";
    inputMapping.className = "form-control";
    inputMapping.value = "fixed:";  // Hint for fixed mapping
    cellMapping.appendChild(inputMapping);
    row.appendChild(cellMapping);
    // Mark row as new (no CSV index)
    row.dataset.new = "true";
    mappingTableBody.appendChild(row);
  });

  // --- Automatically Apply Selected Mapping When Dropdown Changes ---
  mappingSelect.addEventListener("change", function () {
    const selectedMappingKey = mappingSelect.value;
    const rows = mappingTableBody.querySelectorAll("tr");
    if (selectedMappingKey !== "custom" && defaultMappings[selectedMappingKey]) {
      const mapping = defaultMappings[selectedMappingKey];
      rows.forEach(function (row) {
        // For CSV rows, use left cell's textContent; for new rows, use input value
        let original = row.dataset.new ? row.cells[0].querySelector("input").value : row.cells[0].textContent;
        const input = row.cells[1].querySelector("input");
        if (mapping.hasOwnProperty(original)) {
          input.value = mapping[original];
        } else {
          input.value = "";
        }
      });
      // Also add new rows from mapping if not already present
      const appliedKeys = new Set();
      rows.forEach(row => {
        let original = row.dataset.new ? row.cells[0].querySelector("input").value : row.cells[0].textContent;
        appliedKeys.add(original);
      });
      for (let key in mapping) {
        if (!appliedKeys.has(key)) {
          const row = document.createElement("tr");
          const cellOriginal = document.createElement("td");
          const inputOriginal = document.createElement("input");
          inputOriginal.type = "text";
          inputOriginal.className = "form-control";
          inputOriginal.value = key;
          cellOriginal.appendChild(inputOriginal);
          row.appendChild(cellOriginal);
          const cellMapping = document.createElement("td");
          const inputMapping = document.createElement("input");
          inputMapping.type = "text";
          inputMapping.className = "form-control";
          inputMapping.value = mapping[key];
          cellMapping.appendChild(inputMapping);
          row.appendChild(cellMapping);
          row.dataset.new = "true";
          mappingTableBody.appendChild(row);
        }
      }
    } else {
      // For Custom Mapping, reset CSV rows to default
      rows.forEach(function (row) {
        if (row.dataset.new) return; // Don't modify manually added rows
        const original = row.cells[0].textContent;
        const input = row.cells[1].querySelector("input");
        input.value = original;
      });
    }
  });

  // --- Save Mapping to Cookie (10-year expiration) ---
  saveMappingBtn.addEventListener("click", function () {
    const mappingArray = [];
    const rows = mappingTableBody.querySelectorAll("tr");
    rows.forEach(function (row) {
      const original = row.dataset.new ? row.cells[0].querySelector("input").value : row.cells[0].textContent;
      const rule = row.cells[1].querySelector("input").value;
      mappingArray.push({ original, rule });
    });
    setCookie("savedMapping", JSON.stringify(mappingArray), 3650);
    alert("Mapping saved!");
  });

  // --- Load Mapping from Cookie ---
  loadMappingBtn.addEventListener("click", function () {
    const saved = getCookie("savedMapping");
    if (saved) {
      try {
        const mappingArray = JSON.parse(saved);
        const rows = mappingTableBody.querySelectorAll("tr");
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

  // --- Process CSV and Automatically Trigger Download ---
  processBtn.addEventListener("click", function () {
    if (csvData === "") {
      alert("No CSV data available. Please load a file first.");
      return;
    }

    // Build mapping array from table rows.
    const mappingArray = [];
    const rows = mappingTableBody.querySelectorAll("tr");
    rows.forEach(function (row, idx) {
      let original, isNew = false;
      if (row.dataset.new) {
        original = row.cells[0].querySelector("input").value;
        isNew = true;
      } else {
        original = row.cells[0].textContent;
      }
      const rule = row.cells[1].querySelector("input").value;
      mappingArray.push({ original, rule, index: isNew ? null : idx, isNew });
    });

    // Build output mapping using special rules:
    // - "fixed:" => fixed mapping (format: fixed:ColumnName|FixedValue)
    // - "split:" => conditional split mapping (format: split:NegativeHeader|PositiveHeader)
    // - Otherwise => normal mapping.
    const outputMapping = [];
    mappingArray.forEach((item, i) => {
      let rule = item.rule.trim();
      if (rule.startsWith("split:")) {
        let parts = rule.substring(6).split("|");
        if (parts.length === 2) {
          outputMapping.push({
            type: "split",
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

    // Build new CSV header using outputMapping
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

    // Process each CSV row (skipping the header)
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() !== "") {
        const rowValues = parseCSVLine(lines[i]);  // Use custom CSV parser
        const newRow = [];
        outputMapping.forEach(mapping => {
          if (mapping.type === "normal") {
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
              newRow.push("");
              newRow.push("");
            }
          }
        });
        newCsvContent += newRow.join(",") + "\n";
      }
    }

    // Create Blob and trigger download with file name: originalName_remap.csv
    const blob = new Blob([newCsvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    let baseName = fileName;
    if (baseName.toLowerCase().endsWith(".csv")) {
      baseName = baseName.slice(0, -4);
    }
    downloadLink.download = baseName + "_remap.csv";
    downloadLink.click();
  });
});
