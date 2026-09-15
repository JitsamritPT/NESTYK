-- Contract numbers without dashes: RSYYYY##### / LSYYYY#####
-- Also rewrites older dashed values RS-YYYY-##### / LS-YYYY-#####.

UPDATE lease_contracts
SET contract_no = REPLACE(contract_no, '-', ''),
    updated_at = NOW()
WHERE contract_no ~ '^(RS|LS)-[0-9]{4}-[0-9]{5}$';

WITH classified AS (
  SELECT
    c.id,
    CASE
      WHEN COALESCE(tpl.form_kind, mat.form_kind, 'lease') = 'reservation'
        THEN 'RS'
      ELSE 'LS'
    END AS prefix,
    EXTRACT(YEAR FROM (c.created_at AT TIME ZONE 'Asia/Bangkok'))::int AS yr
  FROM lease_contracts c
  LEFT JOIN agreement_templates tpl ON tpl.id = c.template_id
  LEFT JOIN master_agreement_types mat ON mat.code = c.agreement_type_code
  WHERE c.contract_no IS NULL OR BTRIM(c.contract_no) = ''
),
max_seq AS (
  SELECT
    SUBSTRING(contract_no FROM 1 FOR 2) AS prefix,
    SUBSTRING(contract_no FROM 3 FOR 4)::int AS yr,
    MAX(SUBSTRING(contract_no FROM 7 FOR 5)::int) AS max_seq
  FROM lease_contracts
  WHERE contract_no ~ '^(RS|LS)[0-9]{4}[0-9]{5}$'
  GROUP BY 1, 2
),
numbered AS (
  SELECT
    cl.id,
    cl.prefix
      || cl.yr::text
      || LPAD(
        (
          COALESCE(m.max_seq, 0)
          + ROW_NUMBER() OVER (PARTITION BY cl.prefix, cl.yr ORDER BY cl.id)
        )::text,
        5,
        '0'
      ) AS contract_no
  FROM classified cl
  LEFT JOIN max_seq m ON m.prefix = cl.prefix AND m.yr = cl.yr
)
UPDATE lease_contracts lc
SET contract_no = n.contract_no,
    updated_at = NOW()
FROM numbered n
WHERE lc.id = n.id
  AND (lc.contract_no IS NULL OR BTRIM(lc.contract_no) = '');
