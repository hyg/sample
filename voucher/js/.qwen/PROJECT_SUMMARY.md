# Project Summary

## Overall Goal
To upgrade an electronic voucher automation tool to handle special file mappings (specifically where 374.txt corresponds to AVR.374.yaml and AER.364.yaml) while maintaining backward compatibility and supporting single-line input format parsing.

## Key Knowledge
- **File Structure**: The system processes voucher text files (e.g., 299.txt, 300.txt, 373.txt, 374.txt) and generates AVR (Accounting Voucher Record) and AER (Accounting Entry Record) YAML files
- **Mapping Rules**: 
  - General case: TXT file number maps to AVR file number, AER uses incremental IDs
  - Special case: 374.txt → AVR.374.yaml + AER.364.yaml (fixed mapping)
- **Input Formats**: 
  - Multi-line format (each field and value on separate lines)
  - Single-line format (concatenated fields like "交易单号4200002873202510223710908214")
- **Payment Types**: Supports both WeChat (交易单号, 商户单号) and Alipay (订单号, 商家订单号) formats
- **Main Files**: 
  - `voucher.js` - Main processor with command-line support
  - `vi.js` - Interactive mode processor
  - `testcase/` - Contains test input/output files
- **Technology Stack**: Node.js with js-yaml, synchronous file operations, UTF-8 encoding

## Recent Actions
- [DONE] Enhanced `parseVoucherText` function to handle both multi-line and single-line input formats using `splitSingleLineText` utility
- [DONE] Updated both `voucher.js` and `vi.js` with flexible parsing logic that handles concatenated field-value pairs
- [DONE] Implemented special file mapping for 374.txt → AVR.374/AER.364 relationship
- [DONE] Added robust error handling to prevent "Cannot read properties of undefined" errors
- [DONE] Created enhanced generation logic that uses sourceFileName to determine AVR ID mapping
- [DONE] Fixed VoucherID extraction in single-line format (e.g., "交易单号4200002873202510223710908214")
- [DONE] Created comprehensive upgrade guide in `updateprompt.md`
- [DONE] Added proper validation in `generateYamlContent` and `convertDate` functions to handle undefined values
- [DONE] Implemented `generateAerFileWithSpecificId` function to create AER files with predetermined IDs

## Current Plan
- [DONE] Implement single-line format parsing support
- [DONE] Add special case handling for 374.txt → AER.364.yaml mapping  
- [DONE] Enhance error handling to prevent parsing failures
- [DONE] Fix VoucherID extraction from concatenated formats
- [DONE] Maintain backward compatibility with existing functionality
- [DONE] Create upgrade documentation
- [DONE] Verify test case compatibility (373.txt and 374.txt)
- [TODO] Test with additional real-world voucher formats
- [TODO] Consider implementing OCR or image-to-text capabilities for future enhancement
- [TODO] Add validation checks for generated YAML content quality

---

## Summary Metadata
**Update time**: 2025-10-24T09:30:20.289Z 
