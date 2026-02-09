  const fileInput = document.getElementById('csvFile');
  const outputFilenameInput = document.getElementById('outputFilename');

  fileInput.addEventListener('change', function() {
    if (this.files && this.files[0]) {
      // Get the full filename (e.g., "Biology_Grades.csv")
      const originalName = this.files[0].name;
      
      // Remove the extension to get just "Biology_Grades"
      const nameWithoutExtension = originalName.substring(0, originalName.lastIndexOf('.'));
      
      // Update the placeholder of the output input field
      outputFilenameInput.value = "processed_"+nameWithoutExtension;
    }
  });

let processedData = null;
        let outputFilename = '';

        // Handle curve option change
        document.getElementById('curveOption').addEventListener('change', function() {
            const curveSection = document.getElementById('curveSection');
            if (this.value === 'yes') {
                curveSection.classList.remove('hidden');
            } else {
                curveSection.classList.add('hidden');
            }
        });

        // Handle file upload
        document.getElementById('csvFile').addEventListener('change', function() {
            const fileInfo = document.getElementById('fileInfo');
            if (this.files.length > 0) {
                const file = this.files[0];
                fileInfo.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
                fileInfo.classList.remove('hidden');
            } else {
                fileInfo.classList.add('hidden');
            }
        });

        // Curve calculation functions
        function calculateCurvedScore(slope, intercept, score) {
            return slope * score + intercept;
        }

        // CSV parsing function
        function parseCSV(text) {
            const lines = text.split('\n');
            const result = [];
            
            for (let line of lines) {
                if (line.trim() === '') continue;
                
                const row = [];
                let current = '';
                let inQuotes = false;
                
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        row.push(current.trim());
                        current = '';
                    } else {
                        current += char;
                    }
                }
                row.push(current.trim());
                result.push(row);
            }
            
            return result;
        }

        // CSV generation function
        function generateCSV(data) {
            return data.map(row => 
                row.map(cell => {
                    // Escape quotes and wrap in quotes if necessary
                    const cellStr = String(cell);
                    if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                        return '"' + cellStr.replace(/"/g, '""') + '"';
                    }
                    return cellStr;
                }).join(',')
            ).join('\n');
        }

        // Process form submission
        document.getElementById('processorForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const statusDiv = document.getElementById('status');
            const processBtn = document.getElementById('processBtn');
            const downloadBtn = document.getElementById('downloadBtn');
            
            try {
                // Reset status
                statusDiv.classList.add('hidden');
                downloadBtn.classList.add('hidden');
                processBtn.disabled = true;
                processBtn.textContent = 'Processing...';
                
                // Get form values
                const csvFile = document.getElementById('csvFile').files[0];
                const useCurve = document.getElementById('curveOption').value === 'yes';
                let slope = 1.0, intercept = 0.0;
                
                if (useCurve) {
                    slope = parseFloat(document.getElementById('slope').value) || 1.0;
                    intercept = parseFloat(document.getElementById('intercept').value) || 0.0;
                }
                
                const assignmentName = document.getElementById('assignmentName').value;
                const courseName = document.getElementById('courseName').value.toUpperCase();
                const className = document.getElementById('className').value;
                const dueDate = document.getElementById('dueDate').value;

                const [dueYear, dueMonth, dueDay] = dueDate.split('-');
                const formattedDate = `${dueMonth}/${dueDay}`;

                const possiblePoints = document.getElementById('possiblePoints').value;
                outputFilename = document.getElementById('outputFilename').value.replace(' ', '_') + '.csv';
                
                // Read CSV file
                const text = await csvFile.text();
                const zipgradeData = parseCSV(text);
                
                if (zipgradeData.length < 2) {
                    throw new Error('CSV file must have at least a header row and one data row');
                }
                
                const header = zipgradeData[0];
                const dataRows = zipgradeData.slice(1);
                
                // Process student data
                const classSection = {};
                
                for (const row of dataRows) {
                    if (row.length < 8) continue; // Skip incomplete rows
                    
                    const studentName = `${row[5]}, ${row[4]} (${row[2]})`;
                    const rawScore = parseFloat(row[7]) || 0;
                    const totalQuestions = parseFloat(row[6]) || 1;
                    let studentScore = (rawScore / totalQuestions) * 100;
                    
                    if (useCurve) {
                        studentScore = calculateCurvedScore(slope, intercept, studentScore);
                    }
                    
                    classSection[studentName] = Math.round(studentScore * 10) / 10; // Round to 1 decimal
                }
                
                // Generate output CSV
                const outputData = [
                    ["This file should be opened in a spreadsheet application."],
                    ["To import back into Jupiter, save this file as CSV (comma delimited)."],
                    ["You may edit scores and add assignment columns, but do not change anything else."],
                    [],
                    [],
                    ["Class:", courseName+' ('+ className+')'],
                    ["Assignment:", assignmentName, ""],
                    ["Date:", `(${formattedDate})`, ""],
                    ["Possible:", possiblePoints, ""],
                    ["", "Score:", "Comment:"]
                ];
                
                // Add student scores
                for (const [studentName, studentScore] of Object.entries(classSection)) {
                    outputData.push([studentName, studentScore, ""]);
                }
                
                processedData = generateCSV(outputData);
                
                // Show success message
                statusDiv.textContent = `Successfully processed ${Object.keys(classSection).length} students. Ready to download!`;
                statusDiv.className = 'status success';
                statusDiv.classList.remove('hidden');
                downloadBtn.classList.remove('hidden');
                
            } catch (error) {
                statusDiv.textContent = `Error: ${error.message}`;
                statusDiv.className = 'status error';
                statusDiv.classList.remove('hidden');
            } finally {
                processBtn.disabled = false;
                processBtn.textContent = 'Process CSV File';
            }
        });

        // Handle download
        document.getElementById('downloadBtn').addEventListener('click', function() {
            if (processedData) {
                const blob = new Blob([processedData], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = outputFilename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }
        });