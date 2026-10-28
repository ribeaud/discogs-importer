#!/bin/bash
#################
# Script for downloading the orders from deejay.de.
# URL format for downloading the orders as CSV files is:
# https://www.deejay.de/ajaxHelper/getTXT.php?rechID=<order-id>-<customer-id>

# Starting counter with 2
N=105
END=143
CUSTOMER=103274
COOKIE="<cookie-value-after-login-at-deejay.de>"

while [  $N -lt $END ]; do
    RECH_ID=`printf %04d $N`
    echo "Handling order ID '$RECH_ID' for customer '$CUSTOMER'."
    curl --silent --cookie "$COOKIE" "https://www.deejay.de/ajaxHelper/getTXT.php?rechID=$RECH_ID-$CUSTOMER&kunde=$CUSTOMER" > "deejay.$RECH_ID.csv"
    # Increment by one
    ((N=N+1))
done

# Import each file separately: exports from different years have different headers.
# Concatenating them can silently assign values to the wrong columns.
echo "Downloads complete. Import each deejay.*.csv separately with node app.js <file>."
