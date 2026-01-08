#!/bin/bash

SEARCH_TERM="T2_C1_E1_AD1_HOOK1B_DARIA"
MYSQL_CMD="mysql -h shuttle.proxy.rlwy.net -P 50469 -u root -pLeqAXtyXPxxxVXauGDTXALwrRjTEwmUD railway --ssl-mode=DISABLED --connect-timeout=30 -s -N"

echo "🔍 Searching for '$SEARCH_TERM' in ALL tables..."
echo ""

# Get all tables
TABLES=$($MYSQL_CMD -e "SHOW TABLES;" 2>/dev/null)

for TABLE in $TABLES; do
    echo "📋 Searching in table: $TABLE"
    
    # Get all columns for this table
    COLUMNS=$($MYSQL_CMD -e "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='railway' AND TABLE_NAME='$TABLE';" 2>/dev/null)
    
    # Build WHERE clause for all text columns
    WHERE_PARTS=""
    for COL in $COLUMNS; do
        if [ -z "$WHERE_PARTS" ]; then
            WHERE_PARTS="$COL LIKE '%$SEARCH_TERM%'"
        else
            WHERE_PARTS="$WHERE_PARTS OR $COL LIKE '%$SEARCH_TERM%'"
        fi
    done
    
    # Search in this table
    RESULT=$($MYSQL_CMD -e "SELECT COUNT(*) FROM $TABLE WHERE $WHERE_PARTS;" 2>/dev/null)
    
    if [ "$RESULT" -gt 0 ]; then
        echo "  ✅ FOUND $RESULT match(es) in $TABLE!"
        $MYSQL_CMD -e "SELECT * FROM $TABLE WHERE $WHERE_PARTS LIMIT 5;" 2>/dev/null
        echo ""
    else
        echo "  ❌ No matches"
    fi
done

echo ""
echo "✅ Search complete!"
