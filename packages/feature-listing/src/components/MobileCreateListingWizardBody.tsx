import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { MobileButton, MobileBadge, MobileInput, tokens } from '@nestyk/ui/native';
import { ListingEngineConfig } from '../config';

export interface MobileCreateListingWizardBodyProps {
  config: ListingEngineConfig;
  onSubmitListing?: (data: any) => void;
}

export const MobileCreateListingWizardBody: React.FC<MobileCreateListingWizardBodyProps> = ({
  config,
  onSubmitListing,
}) => {
  const [step, setStep] = useState<number>(1);
  const [title, setTitle] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [commission, setCommission] = useState<string>('3.0');

  const themeColor = tokens.colors.roles[config.actorRole];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>ลงประกาศปล่อยเช่า</Text>
          <Text style={styles.subtitle}>
            โหมด {config.actorRole === 'owner' ? 'เจ้าของห้องปล่อยเช่าเอง' : 'นายหน้า Co-Broke'}
          </Text>
        </View>
        <MobileBadge role={config.actorRole} label={`Step ${step}/3`} />
      </View>

      <View style={styles.card}>
        {step === 1 && (
          <View style={{ gap: 14 }}>
            <MobileInput
              label="ชื่อประกาศ / ชื่อโครงการ"
              placeholder="เช่น The Base Sukhumvit 77 ชั้น 15 วิวสระ"
              value={title}
              onChangeText={setTitle}
            />
            <MobileInput
              label="ค่าเช่าต่อเดือน (บาท)"
              placeholder="เช่น 15000"
              keyboardType="numeric"
              value={price}
              onChangeText={setPrice}
            />

            {config.features.enableCommission && (
              <MobileInput
                label="ค่าคอมมิชชั่นนายหน้า Co-Broke (%)"
                placeholder="3.0"
                keyboardType="numeric"
                value={commission}
                onChangeText={setCommission}
                helperText="กำหนดส่วนแบ่งสำหรับ Agent Partner"
              />
            )}

            <View style={{ marginTop: 8 }}>
              <MobileButton onPress={() => setStep(2)}>
                ถัดไป: AI ปรับแต่ง
              </MobileButton>
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: 14 }}>
            <View style={[styles.aiBox, { borderColor: themeColor }]}>
              <Text style={[styles.aiTitle, { color: themeColor }]}>
                ✨ AI Copywriting & Photo Enhancer
              </Text>
              <Text style={styles.aiDesc}>
                Persona: {config.features.aiPersona === 'direct_owner' ? 'สำนวนเจ้าของปล่อยเช่าเอง' : 'สำนวนนายหน้ามืออาชีพ'}
              </Text>
            </View>

            <View style={styles.btnRow}>
              <View style={{ flex: 1 }}>
                <MobileButton variant="outline" onPress={() => setStep(1)}>
                  ย้อนกลับ
                </MobileButton>
              </View>
              <View style={{ flex: 1 }}>
                <MobileButton onPress={() => setStep(3)}>
                  ถัดไป: เอกสาร
                </MobileButton>
              </View>
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={{ gap: 14 }}>
            <View style={styles.docBox}>
              <Text style={styles.docText}>
                เอกสารที่ต้องแนบ: {config.features.docType === 'title_deed' ? 'สำเนาโฉนดที่ดิน/กรรมสิทธิ์ห้องชุด' : 'หนังสือมอบอำนาจ (Power of Attorney)'}
              </Text>
            </View>

            <View style={styles.btnRow}>
              <View style={{ flex: 1 }}>
                <MobileButton variant="outline" onPress={() => setStep(2)}>
                  ย้อนกลับ
                </MobileButton>
              </View>
              <View style={{ flex: 1 }}>
                <MobileButton
                  onPress={() => {
                    onSubmitListing?.({ title, price, commission });
                    Alert.alert('สำเร็จ', 'บันทึกและส่งประกาศเรียบร้อยแล้ว');
                  }}
                >
                  ยืนยันการลงประกาศ
                </MobileButton>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '500',
    color: tokens.colors.textHeading,
  },
  subtitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
    fontWeight: '400',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 18,
  },
  aiBox: {
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  aiTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    marginBottom: 4,
  },
  aiDesc: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
    fontWeight: '400',
  },
  docBox: {
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  docText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textHeading,
    fontWeight: '400',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
});
