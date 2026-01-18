// ============================================================================
// ADMIN PANEL RT - GOOGLE APPS SCRIPT BACKEND
// ============================================================================

// =========================
// KONFIGURASI UTAMA
// =========================
const CONFIG = {
  SPREADSHEET_ID: "1WMy-fI2Puxk5hTvum6zOfbBnjjHGZbjBZwpW4redlAc", // GANTI DENGAN ID SPREADSHEET ANDA
  TIMEZONE: "Asia/Jakarta",
  DATE_FORMAT: "dd-MMM-yyyy"
};

// =========================
// ROUTING HANDLERS
// =========================

/**
 * Handle GET requests (read data)
 */
function doGet(e) {
  console.log('=== GET Request ===');
  console.log('Parameters:', e?.parameter);
  
  try {
    // Enable CORS
    const origin = e?.parameter?.origin || '*';
    
    // Validasi parameter
    if (!e || !e.parameter) {
      return createErrorResponse("Tidak ada parameter yang diterima.", origin);
    }
    
    const sheetName = e.parameter.sheet;
    if (!sheetName) {
      return createErrorResponse("Parameter 'sheet' diperlukan.", origin);
    }
    
    // Baca data dari sheet
    return readData(sheetName, origin);
    
  } catch (error) {
    console.error('GET Error:', error);
    return createErrorResponse(`GET Error: ${error.message}`, '*');
  }
}

/**
 * Handle POST requests (CRUD operations)
 */
function doPost(e) {
  console.log('=== POST Request ===');
  console.log('PostData:', e?.postData?.contents);
  
  try {
    // Enable CORS
    const origin = '*';
    
    // Validasi request
    if (!e.postData || !e.postData.contents) {
      return createErrorResponse("Tidak ada data POST yang diterima.", origin);
    }

    // Parse data
    const requestData = JSON.parse(e.postData.contents);
    console.log('Parsed data:', requestData);
    
    const { sheet, action } = requestData;

    if (!sheet) {
      return createErrorResponse("Parameter 'sheet' diperlukan.", origin);
    }

    if (!action) {
      return createErrorResponse("Parameter 'action' diperlukan.", origin);
    }

    // Route ke fungsi yang sesuai
    let result;
    switch (action) {
      case "create":
        result = createRow(sheet, requestData.values);
        break;
        
      case "update":
        result = updateRow(sheet, requestData.row, requestData.values);
        break;
        
      case "delete":
        result = deleteRow(sheet, requestData.row);
        break;
        
      case "updateCell":
        result = updateCell(sheet, requestData.row, requestData.column, requestData.value);
        break;
        
      case "updateBatch":
        result = updateBatch(sheet, requestData.updates);
        break;
        
      default:
        return createErrorResponse(`Aksi tidak dikenali: ${action}`, origin);
    }
    
    // Tambah CORS header
    return result;
    
  } catch (error) {
    console.error('POST Error:', error);
    return createErrorResponse(`POST Error: ${error.message}`, '*');
  }
}

// =========================
// FUNGSI UTAMA: MEMBACA DATA
// =========================

/**
 * Membaca semua data dari sheet
 */
function readData(sheetName, origin = '*') {
  try {
    console.log(`Membaca data dari sheet: ${sheetName}`);
    
    const sheet = getSheet(sheetName);
    
    // Ambil semua data
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    console.log(`Data ditemukan: ${values.length} baris, ${values[0]?.length || 0} kolom`);
    
    if (values.length === 0 || values[0].length === 0) {
      return createSuccessResponse({ 
        headers: [], 
        rows: [],
        message: "Sheet kosong",
        sheet: sheetName
      }, origin);
    }

    // Ambil header
    const rawHeaders = values[0];
    const dataRows = values.slice(1);
    
    // Format header
    const headers = formatHeaders(rawHeaders);
    
    // Format data rows
    const rows = dataRows.map((row, index) => {
      const rowObj = { _row: index + 2 }; // +2 karena baris 1 adalah header
      
      rawHeaders.forEach((header, colIndex) => {
        if (header !== null && header !== "" && header !== undefined) {
          const headerKey = formatHeader(header);
          const cellValue = row[colIndex];
          rowObj[headerKey] = formatCellValue(cellValue);
        }
      });
      
      return rowObj;
    });

    console.log(`Data diformat: ${headers.length} kolom, ${rows.length} baris`);
    
    return createSuccessResponse({ 
      headers, 
      rows,
      count: rows.length,
      sheet: sheetName
    }, origin);
    
  } catch (error) {
    console.error('Read Data Error:', error);
    return createErrorResponse(`Read Error: ${error.message}`, origin);
  }
}

// =========================
// FUNGSI CRUD
// =========================

/**
 * Membuat baris baru
 */
function createRow(sheetName, values) {
  try {
    console.log(`Membuat baris baru di ${sheetName}:`, values);
    
    const sheet = getSheet(sheetName);
    
    // Validasi input
    if (!Array.isArray(values)) {
      throw new Error("Values harus berupa array");
    }
    
    // Tambah baris baru
    sheet.appendRow(values);
    
    const lastRow = sheet.getLastRow();
    console.log(`Baris berhasil ditambahkan di baris ${lastRow}`);
    
    return createSuccessResponse({
      message: "Baris baru berhasil ditambahkan",
      row: lastRow,
      rowCount: lastRow,
      values: values
    });
    
  } catch (error) {
    console.error('Create Row Error:', error);
    return createErrorResponse(`Create Error: ${error.message}`);
  }
}

/**
 * Mengupdate baris
 */
function updateRow(sheetName, rowNumber, values) {
  try {
    console.log(`Mengupdate baris ${rowNumber} di ${sheetName}:`, values);
    
    const sheet = getSheet(sheetName);
    
    // Validasi
    if (!rowNumber || rowNumber < 2) {
      throw new Error("Nomor baris tidak valid. Minimal baris 2.");
    }
    
    if (!Array.isArray(values)) {
      throw new Error("Values harus berupa array");
    }
    
    if (rowNumber > sheet.getLastRow()) {
      throw new Error(`Baris ${rowNumber} tidak ditemukan. Sheet hanya memiliki ${sheet.getLastRow()} baris.`);
    }
    
    // Update baris
    const range = sheet.getRange(rowNumber, 1, 1, values.length);
    range.setValues([values]);
    
    console.log(`Baris ${rowNumber} berhasil diperbarui`);
    
    return createSuccessResponse({
      message: "Baris berhasil diperbarui",
      row: rowNumber,
      values: values
    });
    
  } catch (error) {
    console.error('Update Row Error:', error);
    return createErrorResponse(`Update Error: ${error.message}`);
  }
}

/**
 * Menghapus baris
 */
function deleteRow(sheetName, rowNumber) {
  try {
    console.log(`Menghapus baris ${rowNumber} dari ${sheetName}`);
    
    const sheet = getSheet(sheetName);
    
    // Validasi
    if (!rowNumber || rowNumber < 2) {
      throw new Error("Nomor baris tidak valid. Minimal baris 2.");
    }
    
    if (rowNumber > sheet.getLastRow()) {
      throw new Error(`Baris ${rowNumber} tidak ditemukan. Sheet hanya memiliki ${sheet.getLastRow()} baris.`);
    }
    
    // Hapus baris
    sheet.deleteRow(rowNumber);
    
    console.log(`Baris ${rowNumber} berhasil dihapus`);
    
    return createSuccessResponse({
      message: "Baris berhasil dihapus",
      row: rowNumber
    });
    
  } catch (error) {
    console.error('Delete Row Error:', error);
    return createErrorResponse(`Delete Error: ${error.message}`);
  }
}

/**
 * Mengupdate satu sel (untuk checkbox)
 */
function updateCell(sheetName, rowNumber, columnName, newValue) {
  try {
    console.log(`Mengupdate sel di ${sheetName}, baris ${rowNumber}, kolom ${columnName}: ${newValue}`);
    
    const sheet = getSheet(sheetName);
    
    // Validasi
    if (!rowNumber || rowNumber < 2) {
      throw new Error("Nomor baris tidak valid. Minimal baris 2.");
    }
    
    if (!columnName) {
      throw new Error("Nama kolom diperlukan");
    }
    
    if (rowNumber > sheet.getLastRow()) {
      throw new Error(`Baris ${rowNumber} tidak ditemukan. Sheet hanya memiliki ${sheet.getLastRow()} baris.`);
    }
    
    // Cari index kolom
    const columnIndex = findColumnIndex(sheet, columnName);
    if (columnIndex === -1) {
      throw new Error(`Kolom "${columnName}" tidak ditemukan di sheet "${sheetName}"`);
    }
    
    // Update sel
    sheet.getRange(rowNumber, columnIndex).setValue(newValue);
    
    console.log(`Sel berhasil diperbarui: baris ${rowNumber}, kolom ${columnIndex} (${columnName})`);
    
    return createSuccessResponse({
      message: "Sel berhasil diperbarui",
      row: rowNumber,
      column: columnName,
      columnIndex: columnIndex,
      value: newValue
    });
    
  } catch (error) {
    console.error('Update Cell Error:', error);
    return createErrorResponse(`Update Cell Error: ${error.message}`);
  }
}

/**
 * Mengupdate banyak sel sekaligus (batch update)
 */
function updateBatch(sheetName, updates) {
  try {
    console.log(`Batch update di ${sheetName}:`, updates);
    
    const sheet = getSheet(sheetName);
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    
    // Ambil header untuk mapping
    const rawHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Validasi updates
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new Error("Tidak ada data update");
    }
    
    let successCount = 0;
    let failedUpdates = [];
    
    // Proses setiap update
    updates.forEach((update, index) => {
      try {
        const { row, column, value } = update;
        
        if (!row || !column) {
          throw new Error("Row dan column diperlukan");
        }
        
        if (row < 2) {
          throw new Error(`Row ${row} tidak valid. Minimal baris 2.`);
        }
        
        if (row > sheet.getLastRow()) {
          throw new Error(`Baris ${row} tidak ditemukan. Sheet hanya memiliki ${sheet.getLastRow()} baris.`);
        }
        
        // Cari index kolom
        const columnIndex = findColumnIndexFromRawHeaders(rawHeaders, column);
        if (columnIndex === -1) {
          throw new Error(`Kolom "${column}" tidak ditemukan`);
        }
        
        console.log(`  Mengupdate: baris ${row}, kolom ${columnIndex} (${column}) = ${value}`);
        
        // Update sel
        sheet.getRange(row, columnIndex).setValue(value);
        successCount++;
        
      } catch (updateError) {
        console.error(`  Update ${index} gagal:`, updateError.message);
        failedUpdates.push({
          index: index,
          update: update,
          error: updateError.message
        });
      }
    });
    
    console.log(`Batch update selesai: ${successCount} berhasil, ${failedUpdates.length} gagal`);
    
    const response = {
      message: `Berhasil memperbarui ${successCount} dari ${updates.length} data`,
      successCount: successCount,
      totalCount: updates.length
    };
    
    if (failedUpdates.length > 0) {
      response.failedUpdates = failedUpdates;
      response.message += ` (${failedUpdates.length} gagal)`;
    }
    
    return createSuccessResponse(response);
    
  } catch (error) {
    console.error('Batch Update Error:', error);
    return createErrorResponse(`Batch Update Error: ${error.message}`);
  }
}

// =========================
// FUNGSI BANTUAN (HELPERS)
// =========================

/**
 * Mendapatkan sheet berdasarkan nama
 */
function getSheet(sheetName) {
  console.log(`Mencari sheet: ${sheetName}`);
  
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    const sheetNames = ss.getSheets().map(s => s.getName());
    console.log(`Sheet tersedia: ${sheetNames.join(', ')}`);
    throw new Error(`Sheet "${sheetName}" tidak ditemukan. Sheet yang tersedia: ${sheetNames.join(', ')}`);
  }
  
  console.log(`Sheet ditemukan: ${sheetName} (${sheet.getLastRow()} baris, ${sheet.getLastColumn()} kolom)`);
  return sheet;
}

/**
 * Mencari index kolom berdasarkan nama
 */
function findColumnIndex(sheet, columnName) {
  const rawHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return findColumnIndexFromRawHeaders(rawHeaders, columnName);
}

/**
 * Mencari index kolom dari array header
 */
function findColumnIndexFromRawHeaders(rawHeaders, columnName) {
  for (let i = 0; i < rawHeaders.length; i++) {
    const header = rawHeaders[i];
    if (header === null || header === undefined) continue;
    
    const formattedHeader = formatHeader(header);
    
    if (formattedHeader === columnName) {
      return i + 1; // +1 karena index di Google Sheets mulai dari 1
    }
  }
  return -1;
}

/**
 * Memformat header tunggal
 */
function formatHeader(header) {
  if (header instanceof Date) {
    return Utilities.formatDate(header, CONFIG.TIMEZONE, CONFIG.DATE_FORMAT);
  }
  return String(header).trim();
}

/**
 * Memformat semua header
 */
function formatHeaders(headers) {
  return headers.map(header => formatHeader(header));
}

/**
 * Memformat nilai sel
 */
function formatCellValue(value) {
  if (value instanceof Date) {
    return value;
  }
  if (value === true || value === false) {
    return value;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

/**
 * Membuat response sukses dengan CORS
 */
function createSuccessResponse(data, origin = '*') {
  const response = {
    success: true,
    timestamp: new Date().toISOString(),
    ...data
  };
  
  console.log('Success response:', response);
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    .addMetaData('Access-Control-Allow-Origin', origin);
}

/**
 * Membuat response error dengan CORS
 */
function createErrorResponse(message, origin = '*') {
  const response = {
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  };
  
  console.log('Error response:', response);
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    .addMetaData('Access-Control-Allow-Origin', origin);
}

// =========================
// FUNGSI TESTING & DEBUG
// =========================

/**
 * Test function untuk debugging
 */
function testFunction() {
  console.log("=== Testing Google Apps Script ===");
  
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheets = ss.getSheets();
    
    console.log(`Total sheets: ${sheets.length}`);
    console.log("Sheets:");
    
    sheets.forEach(sheet => {
      const name = sheet.getName();
      const rows = sheet.getLastRow();
      const cols = sheet.getLastColumn();
      console.log(`- ${name}: ${rows} rows, ${cols} cols`);
      
      // Tampilkan header jika ada
      if (rows > 0 && cols > 0) {
        const headers = sheet.getRange(1, 1, 1, cols).getValues()[0];
        console.log(`  Headers: ${headers.map(h => formatHeader(h)).join(', ')}`);
      }
    });
    
    return "Test completed successfully";
    
  } catch (error) {
    console.error("Test error:", error);
    return `Test failed: ${error.message}`;
  }
}

/**
 * Setup sheet untuk testing
 */
function setupTestSheets() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  
  // Buat sheet jika belum ada
  const sheetNames = ['PENGUMUMAN', 'UANG KAS', 'IURAN BULANAN', 'JADWAL RONDA'];
  
  sheetNames.forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      console.log(`Sheet ${sheetName} dibuat`);
    }
    
    // Setup header untuk sheet boolean
    if (sheetName === 'IURAN BULANAN' || sheetName === 'JADWAL RONDA') {
      if (sheet.getLastRow() === 0) {
        const headers = ['Nama', 'Status', 'Keterangan'];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        console.log(`Header untuk ${sheetName} ditambahkan`);
      }
    }
  });
  
  return "Setup completed";
}
