interface Props {
  code: string;
  size?: number;
  alt?: string;
  style?: React.CSSProperties;
}

export default function Flag({ code, size = 20, alt = "", style }: Props) {
  return (
    <img
      src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
      height={size}
      width="auto"
      alt={alt}
      style={{ display: "inline-block", verticalAlign: "middle", borderRadius: 2, flexShrink: 0, ...style }}
    />
  );
}
