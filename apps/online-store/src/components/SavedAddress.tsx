import styles from "./SavedAddress.module.css";

type SavedAddressProps = {
  address: string;
  postalCode: string;
  city: string;
  variant?: "selectable" | "actions";
  selected?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  editLabel?: string;
  deleteLabel?: string;
  deletingLabel?: string;
  isDeleting?: boolean;
};

export function SavedAddress({
  address,
  postalCode,
  city,
  variant = "selectable",
  selected = false,
  onClick,
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
  deletingLabel,
  isDeleting = false,
}: SavedAddressProps) {
  if (variant === "actions") {
    return (
      <article className={`${styles.card} ${styles.actionsCard}`}>
        <div className={styles.content}>
          <span className={styles.address}>{address}</span>
          <span className={styles.postalLine}>
            {postalCode}, {city}
          </span>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.actionButton} onClick={onEdit}>
            {editLabel}
          </button>
          <button
            type="button"
            className={`${styles.actionButton} ${styles.deleteButton}`}
            onClick={onDelete}
            disabled={isDeleting}
          >
            {isDeleting ? deletingLabel : deleteLabel}
          </button>
        </div>
      </article>
    );
  }

  return (
    <button
      type="button"
      className={selected ? `${styles.card} ${styles.selected}` : styles.card}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className={styles.row}>
        <span
          className={
            selected
              ? `${styles.selectionIndicator} ${styles.selectionIndicatorSelected}`
              : styles.selectionIndicator
          }
          aria-hidden="true"
        />
        <span className={styles.content}>
          <span className={styles.address}>{address}</span>
          <span className={styles.postalLine}>
            {postalCode}, {city}
          </span>
        </span>
      </span>
    </button>
  );
}
