from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
p='output/pdf/iphone18-mock/owner-document-copies-mock.pdf'
c=canvas.Canvas(p,pagesize=A4)
items=[('IDENTITY DOCUMENT COPY',[('Full name','Demo Owner'),('Document ID','TEST-ID-0001'),('Date of birth','01 January 1990'),('Address','Unit 1801, Example Residence, Bangkok')]),('BANK ACCOUNT COPY',[('Account holder','Demo Owner'),('Bank','Example Bank (fictional)'),('Account number','TEST-ACCOUNT-001'),('Account type','Savings / THB')]),('OWNERSHIP DOCUMENT COPY',[('Owner','Demo Owner'),('Property','Example Residence'),('Unit / Floor','1801 / 18'),('Reference','TEST-PROPERTY-001')])]
for n,(title,fields) in enumerate(items,1):
 c.setFillColor(HexColor('#162d42')); c.rect(0,726,595,116,fill=1,stroke=0)
 c.setFillColor(HexColor('#66e0c2')); c.setFont('Helvetica-Bold',12);c.drawString(44,795,'NESTYK / UPLOAD TEST FIXTURE')
 c.setFillColor(HexColor('#ffffff'));c.setFont('Helvetica-Bold',21);c.drawString(44,753,title)
 c.setFillColor(HexColor('#162d42'));c.setFont('Helvetica-Bold',14);c.drawString(44,676,'MOCK COPY - FICTIONAL DATA ONLY')
 c.setFont('Helvetica',11);c.drawString(44,651,'For testing document attachments on iPhone 18 Owner role.')
 y=580
 for k,v in fields:
  c.setFillColor(HexColor('#657585'));c.setFont('Helvetica',11);c.drawString(44,y,k)
  c.setFillColor(HexColor('#162d42'));c.setFont('Helvetica-Bold',14);c.drawString(44,y-24,v);y-=77
 c.saveState();c.translate(110,210);c.rotate(32);c.setFillColor(HexColor('#d9e2e8'));c.setFont('Helvetica-Bold',53);c.drawString(0,0,'SAMPLE ONLY');c.restoreState()
 c.setFillColor(HexColor('#162d42'));c.setFont('Helvetica',12);c.drawString(44,145,'Certified copy (mock): Demo Owner');c.drawString(44,122,'Test date: 02 October 2026')
 c.setFont('Helvetica',9);c.drawString(44,60,'Not an official document. No real identity, bank or property information.');c.drawRightString(552,40,f'{n} / 3');c.showPage()
c.save()
print(p)
