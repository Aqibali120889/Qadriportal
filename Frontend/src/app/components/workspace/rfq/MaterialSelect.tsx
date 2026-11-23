import React, { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Search, Check, X } from "lucide-react";

export interface MaterialItem {
  id?: string;
  branch?: string;
  material: string;
}

export interface MaterialSelectProps {
  value?: string | null;
  materials?: MaterialItem[];
  branch?: string;
  onSave: (value: string) => void | Promise<void>;
  onAddMaterial?: (branch: string, materialName: string) => void | Promise<void>;
  onDeleteMaterial?: (id: string) => void | Promise<void>;
  modified?: boolean;
  style?: React.CSSProperties;
}

export default function MaterialSelect({
  value,
  materials = [],
  branch = "QBL II",
  onSave,
  onAddMaterial,
  onDeleteMaterial,
  modified = false,
  style = {},
}: MaterialSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newMatName, setNewMatName] = useState("");
  const containerRef = useRef<HTMLTableCellElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const addInputRef = useRef<HTMLInputElement | null>(null);

  const branchMaterials = materials.filter((m) => m.branch === branch);
  const availableMaterials = branchMaterials.length > 0 ? branchMaterials : materials;

  const filtered = availableMaterials.filter((m) =>
    (m.material || "").toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsAdding(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isAdding && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [isAdding]);

  const handleSelect = (matName: string) => {
    onSave(matName);
    setIsOpen(false);
    setSearch("");
  };

  const handleDelete = async (e: React.MouseEvent, mat: MaterialItem) => {
    e.stopPropagation();
    if (!mat.id) return;
    if (!confirm(`Delete material "${mat.material}" from reference dropdown?`)) return;
    if (onDeleteMaterial) {
      await onDeleteMaterial(mat.id);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMatName.trim();
    if (!trimmed) return;
    if (onAddMaterial) {
      await onAddMaterial(branch, trimmed);
      onSave(trimmed);
    }
    setNewMatName("");
    setIsAdding(false);
    setIsOpen(false);
  };

  return (
    <td
      ref={containerRef}
      style={{
        ...cellStyle,
        background: modified ? "#fef9c3" : "transparent",
        position: "relative",
        ...style,
      }}
    >
      {modified && <span style={dotStyle} title="Modified" />}

      <div
        onClick={() => setIsOpen(!isOpen)}
        style={triggerStyle}
        title="Click to change material, add new material, or delete material"
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {value || "—"}
        </span>
        <span style={arrowStyle}>▾</span>
      </div>

      {isOpen && (
        <div style={dropdownStyle}>
          <div style={searchBoxStyle}>
            <Search size={13} color="#9ca3af" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search material..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={searchInputStyle}
            />
            {search && (
              <X size={12} color="#9ca3af" style={{ cursor: "pointer" }} onClick={() => setSearch("")} />
            )}
          </div>

          <div style={listStyle}>
            {filtered.length === 0 ? (
              <div style={emptyStyle}>No matching materials</div>
            ) : (
              filtered.map((m) => {
                const isSelected = m.material === value;
                return (
                  <div
                    key={m.id || m.material}
                    onClick={() => handleSelect(m.material)}
                    style={{
                      ...optionStyle,
                      background: isSelected ? "#eff6ff" : "transparent",
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? "#1d4ed8" : "#1f2937",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "#f3f4f6";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span style={optionTextStyle}>{m.material}</span>
                    {isSelected && <Check size={14} color="#1d4ed8" style={{ marginRight: 6 }} />}
                    {m.id && (
                      <button
                        onClick={(e) => handleDelete(e, m)}
                        style={deleteBtnStyle}
                        title={`Delete "${m.material}" from dropdown`}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div style={addSectionStyle}>
            {isAdding ? (
              <form onSubmit={handleAddSubmit} style={addFormStyle}>
                <input
                  ref={addInputRef}
                  type="text"
                  placeholder="Enter new material name..."
                  value={newMatName}
                  onChange={(e) => setNewMatName(e.target.value)}
                  style={addInputStyle}
                />
                <button type="submit" style={saveBtnStyle}>Add</button>
                <button type="button" onClick={() => setIsAdding(false)} style={cancelBtnStyle}>
                  <X size={13} />
                </button>
              </form>
            ) : (
              <button onClick={() => setIsAdding(true)} style={addBtnStyle}>
                <Plus size={14} /> Add New Material
              </button>
            )}
          </div>
        </div>
      )}
    </td>
  );
}

const cellStyle: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: 13,
  verticalAlign: "middle",
  whiteSpace: "nowrap",
  borderBottom: "1px solid #f3f4f6",
};

const triggerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  cursor: "pointer",
  padding: "2px 4px",
  borderRadius: 4,
  borderBottom: "1px dashed #9ca3af",
  gap: 6,
};

const arrowStyle: React.CSSProperties = { fontSize: 10, color: "#6b7280" };

const dotStyle: React.CSSProperties = {
  position: "absolute",
  top: 5,
  right: 3,
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "#f59e0b",
  display: "inline-block",
};

const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  left: 0,
  zIndex: 9999,
  width: 280,
  maxHeight: 320,
  background: "#ffffff",
  boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  padding: 6,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const searchBoxStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 8px",
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
};

const searchInputStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  background: "transparent",
  fontSize: 12,
  outline: "none",
};

const listStyle: React.CSSProperties = {
  overflowY: "auto",
  maxHeight: 200,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const optionStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "6px 8px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
  transition: "background 0.15s ease",
};

const optionTextStyle: React.CSSProperties = {
  flex: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const deleteBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#9ca3af",
  cursor: "pointer",
  padding: "2px 4px",
  borderRadius: 4,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const emptyStyle: React.CSSProperties = {
  padding: 12,
  textAlign: "center",
  fontSize: 12,
  color: "#9ca3af",
};

const addSectionStyle: React.CSSProperties = {
  borderTop: "1px solid #f3f4f6",
  paddingTop: 6,
};

const addBtnStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "6px 10px",
  border: "1px dashed #3b82f6",
  borderRadius: 6,
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const addFormStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
};

const addInputStyle: React.CSSProperties = {
  flex: 1,
  padding: "4px 6px",
  fontSize: 12,
  border: "1px solid #3b82f6",
  borderRadius: 4,
  outline: "none",
};

const saveBtnStyle: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: 12,
  fontWeight: 600,
  background: "#1d4ed8",
  color: "#ffffff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
};

const cancelBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#6b7280",
  cursor: "pointer",
  padding: 2,
};
