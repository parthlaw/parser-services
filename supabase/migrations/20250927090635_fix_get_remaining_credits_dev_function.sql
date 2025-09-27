DROP FUNCTION get_remaining_page_credits_dev(uuid);
CREATE OR REPLACE FUNCTION get_remaining_page_credits_dev(uid UUID)
RETURNS TABLE (
    reference_id UUID,
    source_type VARCHAR(20),
    expires_at TIMESTAMPTZ,
    balance BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pc.reference_id,
        pc.source_type,
        MIN(pc.expires_at) AS expires_at,
        COALESCE(SUM(pc.change), 0) AS balance
    FROM page_credits_dev pc
    WHERE pc.user_id = uid
      AND (pc.expires_at IS NULL OR pc.expires_at > NOW())
    GROUP BY pc.reference_id, pc.source_type
    ORDER BY MIN(pc.expires_at) ASC NULLS LAST;
END;
$$ LANGUAGE plpgsql;